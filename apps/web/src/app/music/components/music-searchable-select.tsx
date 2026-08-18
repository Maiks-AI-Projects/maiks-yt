"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent
} from "react";
import { FiSearch } from "react-icons/fi";

import {
  filterMusicTracks,
  getInitialActiveMusicTrackIndex,
  getMusicTrackUnavailableReason,
  getNextMusicTrackIndex
} from "./music-catalog.service";
import { MusicPreviewPlayer } from "./music-preview-player";
import { MusicTrackSummary } from "./music-track-summary";
import type {
  MusicCatalogTrack,
  MusicSafetyContext,
  MusicSearchableSelectState,
  MusicTrackActionSlot
} from "./music-track.types";
import styles from "./music-searchable-select.module.css";

export type MusicSearchableSelectProps = {
  readonly tracks: readonly MusicCatalogTrack[];
  readonly selectedTrackId: string | null;
  readonly onSelectedTrackChange: (track: MusicCatalogTrack | null) => void;
  readonly actionLabel?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly emptyMessage?: string;
  readonly errorMessage?: string;
  readonly id?: string;
  readonly label?: string;
  readonly loadingMessage?: string;
  readonly onAction?: (track: MusicCatalogTrack) => void;
  readonly placeholder?: string;
  readonly renderAction?: MusicTrackActionSlot;
  readonly safetyContext?: MusicSafetyContext;
  readonly showVolume?: boolean;
  readonly state?: MusicSearchableSelectState;
};

const defaultEmptyMessage = "No matching catalog tracks.";
const defaultErrorMessage = "Music catalog is unavailable.";
const defaultLoadingMessage = "Loading music catalog...";

export const MusicSearchableSelect = ({
  actionLabel,
  className,
  disabled = false,
  emptyMessage = defaultEmptyMessage,
  errorMessage = defaultErrorMessage,
  id,
  label = "Music track",
  loadingMessage = defaultLoadingMessage,
  onAction,
  onSelectedTrackChange,
  placeholder = "Search title, artist, provider, or attribution",
  renderAction,
  safetyContext = "none",
  selectedTrackId,
  showVolume = false,
  state = "idle",
  tracks
}: MusicSearchableSelectProps): React.ReactNode => {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedTrackId) ?? null,
    [selectedTrackId, tracks]
  );
  const filteredTracks = useMemo(() => filterMusicTracks(tracks, query), [query, tracks]);
  const selectedUnavailableReason = selectedTrack
    ? getMusicTrackUnavailableReason(selectedTrack, safetyContext)
    : null;
  const activeTrack = activeIndex >= 0 ? filteredTracks[activeIndex] ?? null : null;
  const activeOptionId = activeTrack ? `${baseId}-option-${activeIndex}` : undefined;
  const isBusy = state === "loading";
  const isUnavailable = state === "error";

  useEffect(() => {
    setActiveIndex(getInitialActiveMusicTrackIndex(filteredTracks, selectedTrackId, safetyContext));
  }, [filteredTracks, safetyContext, selectedTrackId]);

  const selectTrack = useCallback((track: MusicCatalogTrack | null) => {
    if (!track) {
      onSelectedTrackChange(null);
      setIsOpen(false);
      return;
    }

    if (getMusicTrackUnavailableReason(track, safetyContext)) {
      return;
    }

    onSelectedTrackChange(track);
    setQuery("");
    setIsOpen(false);
  }, [onSelectedTrackChange, safetyContext]);

  const moveActiveOption = useCallback((movement: "next" | "previous" | "first" | "last") => {
    setIsOpen(true);
    setActiveIndex((currentIndex) =>
      getNextMusicTrackIndex(filteredTracks, currentIndex, movement, safetyContext)
    );
  }, [filteredTracks, safetyContext]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (disabled || isBusy || isUnavailable) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveOption("next");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveOption("previous");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveActiveOption("first");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveActiveOption("last");
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      event.preventDefault();
      selectTrack(activeTrack);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
      setIsOpen(false);
    }
  };

  const rootClassName = className ? `${styles.root} ${className}` : styles.root;

  return (
    <section className={rootClassName} aria-labelledby={`${baseId}-label`}>
      <div className={styles.selectPanel} ref={rootRef} onBlur={handleBlur}>
        <div className={styles.labelRow}>
          <label id={`${baseId}-label`} htmlFor={inputId}>{label}</label>
          {selectedTrack ? (
            <button
              className={styles.clearButton}
              disabled={disabled}
              onClick={() => selectTrack(null)}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className={styles.searchControl}>
          <FiSearch aria-hidden="true" />
          <input
            aria-activedescendant={isOpen ? activeOptionId : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            autoComplete="off"
            disabled={disabled || isBusy || isUnavailable}
            id={inputId}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTrack ? `${selectedTrack.title} - ${selectedTrack.artist}` : placeholder}
            role="combobox"
            type="search"
            value={query}
          />
        </div>

        <div className={styles.selectedRow} data-empty={!selectedTrack}>
          {selectedTrack ? (
            <MusicTrackSummary
              isSelected
              safetyContext={safetyContext}
              track={selectedTrack}
              unavailableReason={selectedUnavailableReason}
            />
          ) : (
            <span className={styles.placeholderText}>No track selected</span>
          )}
          {selectedTrack && renderAction ? (
            <span className={styles.actionSlot}>{renderAction(selectedTrack)}</span>
          ) : null}
          {selectedTrack && actionLabel && onAction ? (
            <button
              className={styles.actionButton}
              disabled={Boolean(selectedUnavailableReason)}
              onClick={() => onAction(selectedTrack)}
              type="button"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>

        {isBusy || isUnavailable ? (
          <p className={styles.stateMessage} role="status">
            {isBusy ? loadingMessage : errorMessage}
          </p>
        ) : null}

        {isOpen ? (
          <div className={styles.listbox} id={listboxId} role="listbox">
            {!isBusy && !isUnavailable && filteredTracks.length === 0 ? (
              <p className={styles.stateMessage}>{emptyMessage}</p>
            ) : null}
            {!isBusy && !isUnavailable && filteredTracks.length > 0 ? (
              <ul role="presentation">
                {filteredTracks.map((track, index) => {
                  const unavailableReason = getMusicTrackUnavailableReason(track, safetyContext);
                  const isSelected = track.id === selectedTrackId;
                  const isActive = index === activeIndex;

                  return (
                    <li
                      aria-disabled={Boolean(unavailableReason)}
                      aria-selected={isSelected}
                      className={styles.option}
                      data-active={isActive}
                      data-disabled={Boolean(unavailableReason)}
                      id={`${baseId}-option-${index}`}
                      key={track.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectTrack(track)}
                      role="option"
                    >
                      <MusicTrackSummary
                        isSelected={isSelected}
                        safetyContext={safetyContext}
                        track={track}
                        unavailableReason={unavailableReason}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <MusicPreviewPlayer
        showVolume={showVolume}
        track={selectedTrack}
        unavailableReason={selectedUnavailableReason}
      />
    </section>
  );
};
