(() => {
  'use strict';

  const runtime = window.VCLifeShow;
  const audio = document.querySelector('audio[data-shared-player="true"]');
  if (!runtime || !audio) {
    window.VCardBootstrap?.setState('Failed', new Error('VCLifeShow or shared audio is unavailable'));
    return;
  }
  const immutablePlan = runtime.immutablePlan;
  const SCHEMECHANGE_PRIOD = 1;
  // Direct implementation of the instance VCPlay.
  class VCPlay extends runtime.Profile {
    usesTV() { return true; }

    requiresIntro() { return false; }

    restoreColorScheme() { return true; }
    playHint() { return '[L-Click]=Воспроизведение / пауза'; }
    followsColorScheme() { return true; }
    schemeChangePeriod() { return SCHEMECHANGE_PRIOD; }
    shouldAdvanceScheme(playback) {
      const key = playback.song.identity.releaseKey || playback.song.identity.entryKey;
      const changed = this.lastSchemeSongKey !== key;
      this.lastSchemeSongKey = key;
      return changed || ['next', 'auto'].includes(playback.reason);
    }
    allowsCrossAni(song) { return String(song?.identity.listId || '').toLowerCase() === 'ussr'; }
    cyclesNightTone() { return false; }
    continuationDelay() { return 5; }

    tvFrame() {
      const preset = window.VCardDecoration?.current()?.preset || 'duo';
      const styles = preset === 'newspaper' ? ['original', 's_bitmap'] : ['original'];
      return { source: 'img', styles,
        mask: 'off', pick: 'shuffle-bag', glow: 0 };
    }

    previewFrame() {
      return this.tvFrame();
    }

    initialFrame(environment) {
      if (this.noSongSeriesFlag(environment.playback)) return { mediaType: 'cross-ani' };
      return { ...this.tvFrame(), pick: 'keep', keepPhysicalIndex: true };
    }

    chooseSource() {
      const count = this.sourceRun?.scope === 'song' ? this.sourceRun.count + 1 : 1;
      this.sourceRun = { scope: 'song', count };
      return 'song';
    }

    onSongOpen() {}
    onSongStart() {}

    onSongEnd() {}

    onStopped() {}

    noSongSeriesFlag(playback) {
      return this.allowsCrossAni(playback.song) && playback.sourceScope === 'song'
        && playback.life.visualWorld.portal?.selectionSnapshot?.(playback.song.preview)?.songSeriesAbsent === true;
    }

    estimateVerse(playback) {
      const preview = playback.song.preview;
      const text = preview?.querySelector('.song__preview-text');
      if (!text || text.dataset.trackBand?.trim()
        || playback.state !== 'playing' || audio.paused || audio.ended
        || !Number.isFinite(audio.duration) || audio.duration <= 0) return null;
      const verses = [...text.querySelectorAll('.song__track-verse')];
      const counts = verses.map((verse) => (verse.dataset.trackGlow || verse.innerText)
        .split('\n').filter((line) => line.trim()).length);
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (!total || counts.some((count) => count <= 0)) return null;
      const secondsPerLine = audio.duration / total;
      let line = 0;
      for (let index = 0; index < counts.length; index += 1) {
        const lineCount = counts[index];
        const startsAt = line * secondsPerLine;
        const endsAt = (line + lineCount) * secondsPerLine;
        if (audio.currentTime < endsAt || index === counts.length - 1) {
          const slideBoundaries = [startsAt, endsAt];
          return { preview, verse: verses[index], index, startsAt, endsAt,
            isLastVerse: index === counts.length - 1,
            timingSource: 'estimated-lines', lineCount, totalLines: total,
            slideBoundaries };
        }
        line += lineCount;
      }
      return null;
    }

    planDisplay(plan, natural = true, playback = null) {
      const current = Number(this.life.globalSlideCount) || 0;
      const globalSlideNumber = natural ? current + 1 : Math.max(1, current);
      const frame = plan.first
        ? { ...this.tvFrame(), pick: 'keep', keepPhysicalIndex: true }
        : this.tvFrame();
      const cross = plan.effects.find((effect) => effect.name === 'CrossImg');
      return immutablePlan({ ...plan, globalSlideNumber, conditions: [],
        portalFrame: { ...frame, ...(plan.first && cross ? {
          fade: frame.fade ?? cross.fade, unfade: frame.unfade ?? cross.unfade,
        } : {}) } });
    }

    preparePreview(environment, sourceScope) {
      environment.sourceScope = sourceScope || this.chooseSource(environment.song.identity.releaseKey);
    }

    showPreview(environment, source) {
      const noSeries = this.allowsCrossAni(environment.song) && environment.sourceScope === 'song'
        && environment.portal()?.selectionSnapshot?.(environment.song.preview)?.songSeriesAbsent === true;
      if (noSeries) document.dispatchEvent(new CustomEvent('vcard:set-images-visible', { detail: { visible: true } }));
      return environment.portal()?.openIdle?.(environment.song.preview, source
        ? this.previewFrame() : noSeries ? { mediaType: 'cross-ani' } : null);
    }

    launchSource() { return 'song'; }

    configurePlayback(environment, { changingProfile, reuse, launchSource }) {
      const playback = environment.playback;
      playback.sourceScope = reuse ? environment.song.environment.sourceScope
        : changingProfile ? playback.sourceScope
          : launchSource || this.chooseSource(environment.song.identity.releaseKey);
    }

    sourceReady(environment) {
      if (!environment.lastPlan) environment.portal()?.holdSongPreview?.();
    }

    selectResumeSource() {}
  }

  runtime.start({ Profile: VCPlay, playConstants: {
    COLOR_CHANGE_PERIOD: 60, CROSS_PERIOD: 0, CROSS_OPACITY: 0.6,
    CROSS_MANUAL_OPACITY: 0.3, CROSS_CONTINUOUS_OPACITY: 0.8,
  } });
})();
