"""Save one interactive set of outlines per run, with measurements from the labels."""
import argparse
import contextlib
import gzip
import json
import os
from pathlib import Path
from time import perf_counter

import contourpy
import numpy as np
import torch
from scipy import ndimage
from shapes import simulate

PUBLIC = Path(__file__).resolve().parents[1] / 'public' / 'tissues'
CASES = [('Rounded', 0), ('Spindle', .5), ('Spindle', 1), ('Branched', .5), ('Branched', 1)]
SIDE = 7


def contacts(mask):
    """Count host-host interfaces at least four raster edges long."""
    pairs = []
    for a, b in [(mask[1:], mask[:-1]), (mask[:,1:], mask[:,:-1])]:
        keep = (a != b) & (a != 0) & (b != 0)
        pairs.append(np.sort(np.stack([a[keep], b[keep]], axis=1), axis=1))
    values, counts = np.unique(np.concatenate(pairs), return_counts=True, axis=0)
    return {tuple(pair) for pair in values[counts >= 4]}


def outlines(mask):
    result = []
    for i, bounds in enumerate(ndimage.find_objects(mask.astype(int)+1)):
        xs, ys = bounds
        field = np.pad((mask[bounds] == i).astype(float).T, 2)
        contours = contourpy.contour_generator(z=ndimage.gaussian_filter(field,.68)).lines(.47)
        paths = []
        for points in contours:
            # Half a pixel locates the raster centres in domain coordinates.
            points += [xs.start-1.5, ys.start-1.5]
            pts = np.rint(points * (700/len(mask))).astype(int)
            edges = np.diff(pts,axis=0)
            corner = np.any(edges != np.roll(edges,1,axis=0),axis=1)
            vertices = pts[:-1][corner]
            if len(vertices) >= 3:
                paths.append('M'+' '.join(f'{x},{700-y}' for x,y in vertices)+'Z')
        result.append(''.join(paths))
    return result


def build(tissue, shape, amplitude, travel):
    key = f'{tissue}-{shape.lower()}-{int(100*amplitude)}-{travel}'
    start = perf_counter()
    with open(os.devnull, 'w') as sink, contextlib.redirect_stdout(sink):
        masks, centres, errors, strength = simulate(shape, amplitude, tissue, travel)
    elapsed = perf_counter() - start
    initial = contacts(masks[0])
    frames = []
    for mask, cells in zip(masks, centres):
        current = contacts(mask)
        frames.append(dict(paths=outlines(mask), centres=np.round(cells*100,2).tolist(),
                           lost=len(initial-current), gained=len(current-initial)))
    data = dict(frames=frames, seconds=round(elapsed,2), meanAreaError=round(float(errors.mean()),5),
                maxAreaError=round(float(errors.max()),4), actualStrength=strength.round(4).tolist())
    PUBLIC.mkdir(exist_ok=True, parents=True)
    target = PUBLIC/(key+'.json.gz')
    target.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0))
    moved=np.linalg.norm(centres[-1,1:] - centres[0,1:],axis=1)
    print(key, 'seconds',round(elapsed,1),'max host shift',round(moved.max(),2),
          'lost contacts',frames[-1]['lost'],'mean error',data['meanAreaError'],flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tissue', choices=['mosaic','aligned','mixed'],required=True)
    args = parser.parse_args()
    torch.set_num_threads(1)
    for travel in (1,0):
        for shape, amplitude in CASES:
            build(args.tissue, shape, amplitude, travel)
