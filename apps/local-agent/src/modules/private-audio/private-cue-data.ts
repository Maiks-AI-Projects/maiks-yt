import type { PrivateCueRequest } from "./private-audio.types.js";

const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const HEADER_BYTES = 44;

function writeAscii(buffer: Buffer, offset: number, value: string): void {
  buffer.write(value, offset, value.length, "ascii");
}

export function createCueWav(request: PrivateCueRequest): Buffer {
  const sampleCount = Math.max(1, Math.round((SAMPLE_RATE * request.durationMs) / 1_000));
  const dataBytes = sampleCount * 2;
  const buffer = Buffer.alloc(HEADER_BYTES + dataBytes);

  writeAscii(buffer, 0, "RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  writeAscii(buffer, 8, "WAVE");
  writeAscii(buffer, 12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28);
  buffer.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  writeAscii(buffer, 36, "data");
  buffer.writeUInt32LE(dataBytes, 40);

  const fadeSamples = Math.min(Math.round(SAMPLE_RATE * 0.02), Math.floor(sampleCount / 2));
  for (let index = 0; index < sampleCount; index += 1) {
    const edgeDistance = Math.min(index, sampleCount - index - 1);
    const envelope = fadeSamples === 0 ? 1 : Math.min(1, edgeDistance / fadeSamples);
    const phase = (2 * Math.PI * request.frequencyHz * index) / SAMPLE_RATE;
    const sample = Math.round(Math.sin(phase) * request.volume * envelope * 0x7fff);
    buffer.writeInt16LE(sample, HEADER_BYTES + index * 2);
  }

  return buffer;
}
