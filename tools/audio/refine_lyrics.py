"""Generate word timing from supplied lyrics and the local recording (CPU)."""
import os
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.audio-tools'))
os.environ['HF_HOME'] = str(ROOT / '.audio-models')
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
import json
import re
import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.tokenizer import Tokenizer

rows = json.loads((ROOT / 'audio/analysis/kleopatri-alignment.json').read_text(encoding='utf-8'))
audio = decode_audio(str(ROOT / 'audio/tracks/kleopatri.mp3'))
print('Audio duration:', len(audio)/16000, flush=True)
model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4, download_root=str(ROOT / '.audio-models'))
tokenizer = Tokenizer(model.hf_tokenizer, model.model.is_multilingual, task='transcribe', language='ru')
groups = [[row] for row in rows if row.get('words') and (any(w['end']-w['start'] < .05 or w['end']-w['start'] > 2.5 for w in row['words']) or abs(row['words'][0]['start']-row['time']) > .8)]
for gi, group in enumerate(groups):
    start = max(0, group[0]['time'] - .15)
    end = min(len(audio)/16000, group[-1]['end'])
    chunk = audio[int(start*16000):int(end*16000)]
    features = model.feature_extractor(chunk)
    frames = features.shape[-1]
    features = np.pad(features, ((0,0),(0,max(0,3000-frames))))[:, :3000]
    tokens = tokenizer.encode(' ' + ' '.join(row['text'] for row in group))
    alignment = model.find_alignment(tokenizer, [tokens], model.encode(features), frames)[0]
    spans = []
    offset = 0
    for part in alignment:
        size = len(re.sub(r'\s', '', part['word']))
        spans.append((offset, offset+size, start+float(part['start']), start+float(part['end'])))
        offset += size
    offset = 0
    for row in group:
        row['words'] = []
        for word in row['text'].split():
            size = len(word)
            hits = [p for p in spans if p[0] < offset+size and p[1] > offset]
            if not hits: raise ValueError('Unaligned word: '+word)
            row['words'].append({'text':word,'start':round(hits[0][2],3),'end':round(hits[-1][3],3)})
            offset += size
    print('Aligned group',gi+1,'/',len(groups),flush=True)
    (ROOT / 'audio/analysis/kleopatri-alignment.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('Alignment complete',flush=True)
