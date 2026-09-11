"""Create product subtitle lines and word timings for the supplied recording."""
import json
import os
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.audio-tools'))
os.environ['HF_HOME'] = str(ROOT / '.audio-models')

from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.tokenizer import Tokenizer


def seconds(minutes, value):
    return int(minutes) * 60 + float(value)


def stamp(value):
    centiseconds = round(value * 100)
    return f'{centiseconds // 6000:02d}:{centiseconds // 100 % 60:02d}.{centiseconds % 100:02d}'


def clean_length(value):
    return len(re.sub(r'[^a-z0-9]+', '', value.lower()))


TRACK_START = 25.71
TRACK_END = 258.79
CORRECTIONS = {
    "Who else really tryna fuck with Hollywood Cole? I'm with Marley G bro":
        "Who else is really trying to fuck with Hollywood Cole I'm with Marley G's bro",
    "Flyin' Hollygrove chicks to my Hollywood shows":
        "Flying Holly Grove chicks to my Hollywood shows",
    "And I wanna tell you somethin' that you prolly should know":
        "And I wanna tell you something that you probably should know",
    "This that Slumdog Millionaire Bollywood flow, and uh":
        "This that Slum Dog Millionaire Bollywood flow and uh",
    "My real friends never hearin' from me":
        "My real friends never hearing from me",
    "Don't like my women single, I like my chicks in twos":
        "Don't like my women single, I like my chicks in two's",
    "And these days all the girls is down to roll":
        "And these days all the girls are down to roll",
    "Plus I been sippin', so this shit is movin' kinda slow":
        "Plus I been sipping, so this shit is moving kinda slow",
    "You know you're at the top when only heaven's right above it":
        "You know you at the top when only heaven is right above it",
    "If you ain't runnin' with it, run from it motherfucker, alright":
        "If you ain't running with it, run from it motherfucker",
    "Now somebody show some money in this bitch":
        "Alright, now somebody show some money in this bitch",
    "And I got my B's with me like some honey in this bitch, ya dig?":
        "And I got my B's with me like some honey in this bitch, you dig",
    "I got my gun in my boot purse":
        "And I got my gun in my boo purse",
    "And I don't bust back because I shoot first":
        "And I don't bust back, because I shoot first",
    "And I smoked 'til I got chest pains":
        "And I smoke 'til I got chest pains",
    "And you niggas know I rep my gang like Jesse James":
        "And you niggas know I rep my gang like Jessie James",
    "I been fly so long I fell asleep on the fuckin' plane":
        "I been flyin' so long I fell asleep on the fucking plane",
    "Life is a beach, I'm just playin' in the sand":
        "Life is a beach, I'm just playing in the sand",
    "I'm on a paper trail, it ain't no tellin' where it took me":
        "I'm on a paper trail and ain't no telling where it took me",
    "Uh": "",
    "How do he say what's never said?":
        "How do you say what's never said?",
    "Limpin' off tour 'cause I made more off my second leg":
        "Limping off tour, 'cause I made more off my second leg",
    "I could hand it to Drake or do a quarterback draw":
        "I can hand it to Drake or do a quarterback draw",
    "Uh, now-now c'mon be my blood donor":
        "Uh, now come on be my blood donor",
    "Kane got the fuckin' beat jumpin' like a jumping jack":
        "Kane got the fucking beat jumping like a jumping jack",
    "Hip-hop, I'm the heart of that, nigga nothin' short of that":
        "Hip-Hop, I'm the heart of that Nigga, nothing short of that",
    "Now somebody show some money in this bitch (yeah)":
        "Alright, now somebody show some money in this bitch",
    "And I got my B's with me like some honey in this bitch, ya dig? (Suwoo)":
        "And I got my b's with me like some honey in this bitch, you dig",
    "And I got my gun in my boot purse (five star)":
        "I got my gun in my boo purse",
    "And I don't bust back because I shoot first (yeah) (alright)":
        "And I don't bust back, because I shoot first",
}


catalog = json.loads((ROOT / 'audio/analysis/right-above-it-lrclib.json').read_text(encoding='utf-8'))
entry = next(item for item in catalog if item['id'] == 36303208)
rows = []
for line in entry['syncedLyrics'].splitlines():
    match = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)', line)
    if match:
        rows.append({'time': seconds(match[1], match[2]), 'text': match[3].strip()})
for index, row in enumerate(rows):
    row['end'] = rows[index + 1]['time'] if index + 1 < len(rows) else entry['duration']
rows = [
    {**row, 'text': CORRECTIONS.get(row['text'], row['text'])}
    for row in rows
    if row['end'] > TRACK_START and row['time'] < TRACK_END
]

audio = decode_audio(str(ROOT / 'audio/tracks/right-above-it.mp3'))
model = WhisperModel(
    'small', device='cpu', compute_type='int8', cpu_threads=4,
    download_root=str(ROOT / '.audio-models'), local_files_only=True,
)
tokenizer = Tokenizer(model.hf_tokenizer, model.model.is_multilingual, task='transcribe', language='en')

groups = []
for row in rows:
    if not row['text']:
        continue
    if not groups or row['end'] - groups[-1][0]['time'] > 23.5 or row['time'] - groups[-1][-1]['end'] > 3:
        groups.append([])
    groups[-1].append(row)

for group_index, group in enumerate(groups):
    start = max(0, group[0]['time'] - .25)
    end = min(len(audio) / 16000, group[-1]['end'] + .15)
    clip = audio[int(start * 16000):int(end * 16000)]
    features = model.feature_extractor(clip)
    frames = features.shape[-1]
    features = np.pad(features, ((0, 0), (0, max(0, 3000 - frames))))[:, :3000]
    source_words = [word for row in group for word in row['text'].split()]
    alignment = model.find_alignment(
        tokenizer,
        [tokenizer.encode(' ' + ' '.join(source_words))],
        model.encode(features), frames,
    )[0]
    spans = []
    offset = 0
    for item in alignment:
        size = clean_length(item['word'])
        if not size:
            continue
        spans.append((offset, offset + size, start + float(item['start']), start + float(item['end'])))
        offset += size
    source_offset = 0
    for row in group:
        row['words'] = []
        for word in row['text'].split():
            size = clean_length(word)
            hits = [span for span in spans if span[0] < source_offset + size and span[1] > source_offset]
            if not hits:
                raise RuntimeError(f'Could not align: {word}')
            row['words'].append({
                'text': word,
                'start': round(hits[0][2], 3),
                'end': round(hits[-1][3], 3),
            })
            source_offset += size
    print(f'Aligned group {group_index + 1}/{len(groups)}', flush=True)

# Split long source lines into compact single-line product captions.
product_lines = []
for row in rows:
    words = row.get('words', [])
    if not words:
        continue
    current = []
    for word in words:
        current.append(word)
        chars = sum(len(item['text']) for item in current) + len(current) - 1
        closes_phrase = word['text'].endswith((',', ';', ':', '?', '!'))
        if len(current) >= 7 or chars >= 38 or (closes_phrase and len(current) >= 4):
            product_lines.append(current)
            current = []
    if current:
        product_lines.append(current)

output = ['[00:00.00]']
for words in product_lines:
    start = words[0]['start']
    marked = ' '.join(
        f'<{stamp(word["start"])}>{word["text"]}<{stamp(max(word["start"], word["end"]))}>'
        for word in words
    )
    output.append(f'[{stamp(start)}] {marked}')
(ROOT / 'audio/lyrics/right-above-it.lrc').write_text('\n'.join(output) + '\n', encoding='utf-8')
(ROOT / 'audio/analysis/right-above-it-alignment.json').write_text(
    json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8'
)
print(f'Saved {len(product_lines)} caption lines', flush=True)
