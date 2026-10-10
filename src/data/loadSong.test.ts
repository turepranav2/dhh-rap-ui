import { describe, expect, it } from 'vitest';
import { listSongIds, loadSong } from './loadSong';

describe('loadSong', () => {
  it('lists the committed songs', () => {
    expect(listSongIds()).toContain('101');
  });

  it('loads 101 with a schema-valid song and lyrics either null or a string map', async () => {
    const { song, lyrics } = await loadSong('101');
    expect(song.id).toBe('101');
    expect(song.spotifyTrackId).toBe('47TOcXCzgTPkbAkSZv0BCl');
    expect(Array.isArray(song.lines)).toBe(true);
    if (lyrics !== null) {
      for (const v of Object.values(lyrics)) expect(typeof v).toBe('string');
    }
  });

  it('throws a helpful error for an unknown id', async () => {
    await expect(loadSong('nope')).rejects.toThrow(/Unknown song "nope"/);
  });
});
