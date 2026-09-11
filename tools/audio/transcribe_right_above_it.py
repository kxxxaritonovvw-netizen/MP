"""Transcribe the supplied Right Above It recording with word timestamps."""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.audio-tools'))
os.environ['HF_HOME'] = str(ROOT / '.audio-models')

from faster_whisper import WhisperModel

audio_path = ROOT / 'audio/tracks/right-above-it.mp3'
model = WhisperModel(
    'small', device='cpu', compute_type='int8', cpu_threads=4,
    download_root=str(ROOT / '.audio-models'), local_files_only=True,
)
segments, info = model.transcribe(
    str(audio_path), language='en', task='transcribe', beam_size=5,
    word_timestamps=True, vad_filter=False,
    no_speech_threshold=None, log_prob_threshold=None,
    compression_ratio_threshold=None,
    initial_prompt='Lil Wayne featuring Drake, Right Above It.',
)
result = {
    'language': info.language,
    'duration': info.duration,
    'segments': [],
}
for segment in segments:
    words = [
        {
            'text': word.word.strip(),
            'start': round(word.start, 3),
            'end': round(word.end, 3),
            'probability': round(word.probability, 3),
        }
        for word in (segment.words or []) if word.word.strip()
    ]
    result['segments'].append({
        'start': round(segment.start, 3),
        'end': round(segment.end, 3),
        'text': segment.text.strip(),
        'words': words,
    })
    print(f'{segment.start:6.2f}-{segment.end:6.2f} {segment.text.strip()}', flush=True)

(ROOT / 'audio/analysis/right-above-it-transcript.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8'
)
print('Saved transcript', flush=True)
