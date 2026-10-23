import { Lrc } from './lrc.js';
export class Runner {
    constructor(lrc = new Lrc(), offset = true) {
        this.offset = offset;
        this._currentIndex = -1;
        this._currentWordIndexes = null;
        this._lrc = lrc.clone();
        this.lrcUpdate();
    }
    get lrc() {
        return this._lrc;
    }
    set lrc(lrc) {
        this._lrc = lrc.clone();
        this.lrcUpdate();
    }
    lrcUpdate() {
        if (this.offset) {
            this._offsetAlign();
        }
        this._sort();
    }
    _offsetAlign() {
        if ('offset' in this.lrc.info) {
            const offset = parseInt(this.lrc.info.offset) / 1000;
            if (!isNaN(offset)) {
                this.lrc.offset(offset);
                delete this.lrc.info.offset;
            }
        }
    }
    _sort() {
        this.lrc.lyrics.sort((a, b) => a.timestamp - b.timestamp);
        this.lrc.lyrics.forEach((line) => {
            var _a;
            (_a = line.wordTimestamps) === null || _a === void 0 ? void 0 : _a.sort((a, b) => a.timestamp - b.timestamp);
        });
    }
    timeUpdateAndGetWordIndexes(index, timestamp) {
        var _a;
        const words = (_a = this.lrc.lyrics[index]) === null || _a === void 0 ? void 0 : _a.wordTimestamps;
        if (!words || words.length === 0)
            return null;
        const wordIndex = this._findWordIndex(timestamp, words);
        if (wordIndex === -1)
            return null;
        const aheadWords = words.slice(0, wordIndex + 1);
        const currentWord = aheadWords[aheadWords.length - 1];
        if (!currentWord)
            return null;
        let charEndIndex = aheadWords.reduce((sum, word) => sum + word.content.length, 0);
        let charStartIndex = charEndIndex - currentWord.content.length;
        if (currentWord.content.startsWith(' '))
            charStartIndex += 1;
        if (currentWord.content.endsWith(' '))
            charEndIndex -= 1;
        return {
            wordIndex,
            charStartIndex,
            charEndIndex,
        };
    }
    timeUpdate(timestamp) {
        this._currentIndex = this._findIndex(timestamp);
        this._currentWordIndexes = this.timeUpdateAndGetWordIndexes(this._currentIndex, timestamp);
    }
    _findIndex(timestamp) {
        const nextIndex = this.lrc.lyrics.findIndex((lyric) => lyric.timestamp > timestamp);
        if (nextIndex === -1)
            return this.lrc.lyrics.length - 1;
        return nextIndex - 1;
    }
    _findWordIndex(timestamp, wordTimestamps) {
        const nextIndex = wordTimestamps.findIndex((word) => word.timestamp > timestamp);
        if (nextIndex === -1)
            return wordTimestamps.length - 1;
        return nextIndex - 1;
    }
    getInfo() {
        return this.lrc.info;
    }
    getLyrics() {
        return this.lrc.lyrics;
    }
    getLyric(index = this.curIndex()) {
        if (index < 0)
            return this.lrc.lyrics[0];
        if (index > this.lrc.lyrics.length - 1)
            return this.lrc.lyrics[this.lrc.lyrics.length - 1];
        return this.lrc.lyrics[index];
    }
    curIndex() {
        return this._currentIndex;
    }
    curWordIndexes() {
        return this._currentWordIndexes;
    }
    curLyric() {
        return this.getLyric();
    }
}
