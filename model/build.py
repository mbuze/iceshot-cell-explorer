"""Recompute the five runs and render the masks used in the presentation."""
import contextlib
import json
import os
from pathlib import Path
from time import perf_counter
import numpy as np
import torch
from PIL import Image, ImageDraw
from shapes import simulate, STEPS
from render import field

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
SIZE = (432, 288)
COLS = 8
CASES = [('Rounded', 0), ('Spindle', .5), ('Spindle', 1),
         ('Branched', .5), ('Branched', 1)]


def main():
    torch.set_num_threads(1)
    PUBLIC.mkdir(exist_ok=True)
    data = {}
    for shape, amplitude in CASES:
        key = f'{shape.lower()}-{int(100*amplitude)}'
        start = perf_counter()
        with open(os.devnull, 'w') as quiet, contextlib.redirect_stdout(quiet):
            masks, centres, errors, strength = simulate(shape, amplitude)
        elapsed = perf_counter() - start
        if not data:
            initial_mask = masks[0].copy()
            cell = centres[0, 0]
            neighbour = 1 + np.linalg.norm(centres[0, 1:] - cell - [1., .1], axis=1).argmin()
            view = (cell[0]-1.59, cell[1]+1.64, 4.43)
        assert np.array_equal(initial_mask, masks[0])
        atlas = Image.new('RGB', (SIZE[0]*COLS, SIZE[1]*((STEPS+COLS)//COLS)))
        displacement = np.linalg.norm(centres[:,neighbour]-centres[0,neighbour], axis=1)
        for k, mask in enumerate(masks):
            frame, pixel = field(mask, view, SIZE, [neighbour])
            draw = ImageDraw.Draw(frame)
            origin = np.array(pixel(centres[0, neighbour]))
            now = np.array(pixel(centres[k, neighbour]))
            draw.line([tuple(origin), tuple(now)], fill='#c1f1ec', width=2)
            draw.ellipse([tuple(origin-5), tuple(origin+5)],outline='#c1f1ec',width=2)
            draw.ellipse([tuple(now-4), tuple(now+4)],fill='#b3ffe9',outline='#223f46')
            atlas.paste(frame, (k%COLS*SIZE[0], k//COLS*SIZE[1]))
        atlas.save(PUBLIC/f'{key}.webp', quality=87, method=5)
        data[key] = dict(seconds=round(elapsed,2), displacement=displacement.round(4).tolist(),
                         mean_area_error=float(errors.mean()), peak_pigment_error=float(errors[:,0].max()),
                         actual_strength=strength.round(4).tolist())
        print(key, elapsed, flush=True)
    (PUBLIC/'runs.json').write_text(json.dumps(data, indent=2)+'\n')


if __name__ == '__main__':
    main()
