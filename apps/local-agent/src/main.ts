import { loadLocalAgentConfig, resolveLocalAgentStateFile } from "./config/local-agent.config.js";
import { readDeviceCredential } from "./identity/device-credential.service.js";
import { ModuleHost } from "./modules/module-host.service.js";
import { PipeWirePrivateAudioBackend } from "./modules/private-audio/pipewire-private-audio.service.js";
import { PrivateAudioModule } from "./modules/private-audio/private-audio.service.js";
import { VlcMusicModule } from "./modules/vlc-music/vlc-music.service.js";
import {
  AuthenticatedVlcMediaSourceResolver,
  localAgentApiOrigin
} from "./modules/vlc-music/vlc-media-source.service.js";
import { VlcProcessBackend } from "./modules/vlc-music/vlc-process.service.js";
import { LOCAL_AGENT_PROTOCOL_VERSION, type CommandEnvelope } from "./protocol/agent-protocol.types.js";
import { AgentRuntime } from "./runtime/agent-runtime.service.js";
import { FileAgentStateStore } from "./state/file-agent.state.js";
import { WebSocketOutboundConnector } from "./transport/websocket-transport.js";

const SERVICE_VERSION = "0.0.0";

async function runProofCommand(kind: "cue" | "tts", text?: string): Promise<void> {
  const controller = new AbortController();
  const module = new PrivateAudioModule(new PipeWirePrivateAudioBackend());
  const host = new ModuleHost([module]);
  await host.start(controller.signal);
  try {
    const command: CommandEnvelope = {
      type: "command",
      eventId: `self-test-${Date.now()}`,
      commandId: `self-test-${kind}`,
      issuedAt: new Date().toISOString(),
      capability: "private-audio",
      action: kind === "cue" ? "cue.play" : "tts.speak",
      payload: kind === "cue" ? {} : { text: text ?? "Maiks local agent private audio test" }
    };
    await host.execute(command, controller.signal);
    console.info(`Private ${kind} proof completed on stream_private`);
  } finally {
    await host.stop();
  }
}

async function main(): Promise<void> {
  const [argument, ...rest] = process.argv.slice(2);
  if (argument === "--print-device-id") {
    const stateStore = await FileAgentStateStore.open(resolveLocalAgentStateFile());
    console.info(stateStore.getDeviceId());
    return;
  }
  if (argument === "--self-test-cue") {
    await runProofCommand("cue");
    return;
  }
  if (argument === "--self-test-tts") {
    await runProofCommand("tts", rest.join(" ").trim() || undefined);
    return;
  }
  if (argument !== undefined) {
    throw new Error(`Unknown local-agent argument: ${argument}`);
  }

  const config = loadLocalAgentConfig();
  const stateStore = await FileAgentStateStore.open(config.stateFile);
  const credential = await readDeviceCredential(config.credentialFile);
  const controller = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => controller.abort(new Error(`Received ${signal}`)));
  }

  const moduleHost = new ModuleHost([
    new PrivateAudioModule(new PipeWirePrivateAudioBackend()),
    new VlcMusicModule(new VlcProcessBackend(new AuthenticatedVlcMediaSourceResolver({
      authorizationOrigin: localAgentApiOrigin(config.url),
      bearerCredential: credential
    })))
  ]);
  const runtime = new AgentRuntime({
    connector: new WebSocketOutboundConnector(config.url, credential, config.agentId),
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    identity: {
      agentId: config.agentId,
      deviceId: stateStore.getDeviceId(),
      protocolVersion: LOCAL_AGENT_PROTOCOL_VERSION,
      serviceVersion: SERVICE_VERSION
    },
    moduleHost,
    reconnect: { baseMs: config.reconnectBaseMs, maxMs: config.reconnectMaxMs },
    stateStore
  });
  await runtime.run(controller.signal);
}

main().catch((error: unknown) => {
  console.error("Maiks.yt local agent stopped", error);
  process.exitCode = 1;
});
