"""Serve ICeShOT allocations to the shared protrusion simulation."""
import contextlib
import json
import os
import sys
from types import SimpleNamespace

import numpy as np
from branch_cost import native_cost
from press import WIDTH, HEIGHT
from tissue import LazyTensor, torch
from vendor.tissue_ot import LBFGSB, OT_solver


def segment_distance(grid, a, b):
    v = np.asarray(b) - a
    u = grid - a
    length_squared = v @ v
    if length_squared <= 1e-10:
        return np.full(len(grid), np.inf)
    fraction = np.clip((u * v).sum(axis=1) / length_squared, 0, 1)
    return ((u - fraction[:, None] * v) ** 2).sum(axis=1)


def main():
    torch.set_num_threads(1)
    nx, ny = map(int, sys.argv[1:])
    y, x = torch.meshgrid((torch.arange(ny) + .5) * HEIGHT / ny,
                         (torch.arange(nx) + .5) * WIDTH / nx, indexing='ij')
    grid = torch.stack([x.flatten(), y.flatten()], dim=1).contiguous()
    xy = grid.numpy()
    solver = OT_solver()
    gy = torch.zeros(len(grid))
    labels = torch.zeros_like(gy)
    with open(os.devnull, 'w') as quiet:
        for line in sys.stdin:
            data = json.loads(line)
            cells = data['cells']
            sites = torch.tensor([[c['x'], c['y']] for c in cells], dtype=grid.dtype)
            matrices = np.array([[c['xx'], c['xy'], c['yy']] for c in cells])
            arms = [c.get('arms', []) for c in cells]
            weights = torch.tensor([*data['weights'], 0.], dtype=grid.dtype)
            areas = np.array([c['area'] for c in cells]) / (WIDTH * HEIGHT)
            target = torch.as_tensor(np.r_[areas, 1-areas.sum()], dtype=grid.dtype)
            with contextlib.redirect_stdout(quiet):
                cost = native_cost(grid, sites, matrices, arms)
                probes = cells[0].get('probes', [])
                if probes:
                    origin = sites[0].numpy()
                    k = cells[0]["k"]
                    base = k*((xy-origin)**2).sum(axis=1)
                    active = base.copy()
                    for bx, by, tx, ty in probes:
                        q = np.minimum(segment_distance(xy, origin, [bx, by]),
                                       segment_distance(xy, [bx, by], [tx, ty]))
                        active = np.minimum(active, k*(.16 + 6.5*q))
                    flag = torch.zeros((len(cells), 1, 1))
                    flag[0] = 1.
                    cost += LazyTensor(flag) * LazyTensor(torch.from_numpy(
                        (active-base).astype(np.float32))[None, :, None])
                if not data.get("allocate_only"):
                    LBFGSB(cost, range(22), weights, gy, a=target, max_epoch=2, tol=.012)
                state = SimpleNamespace(x=sites, y=grid, f_x=weights, labels=labels)
                solver.Laguerre_allocation(state, cost)
            raster = labels.numpy().astype(np.uint8)
            raster[raster >= len(cells)] = 255
            print(json.dumps({'weights': weights[:-1].tolist(),
                              'raster': raster.tobytes().hex()}), flush=True)


if __name__ == '__main__':
    main()
