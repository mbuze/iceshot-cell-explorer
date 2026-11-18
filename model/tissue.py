"""CPU state for the free-boundary, isotropic 2D ICeShOT example."""
import math
import os
import tempfile
from pathlib import Path

os.environ.setdefault("KEOPS_CACHE_FOLDER", str(Path(tempfile.gettempdir()) / f"iceshot-keops-{os.getuid()}"))
os.environ.setdefault("OMP_NUM_THREADS", "1")
import numpy as np
import torch
from pykeops.torch import LazyTensor
from vendor.division import sample_unit
from vendor.tissue_ot import OT_solver, l2_cost


class Tissue:
    d = 2

    def __init__(self, grid, area):
        self.N_cells = 1
        self.grid = grid
        axis = (torch.arange(grid) + 0.5) / grid
        self.y = torch.cartesian_prod(axis, axis)
        self.vol_grid = 1 / grid**2
        self.x = torch.tensor([[0.5, 0.5]])
        self.volumes = torch.tensor([area, 1 - area])
        self.axis = sample_unit(1, 2)
        self.ar = torch.ones(1)
        self.orientation = self.orientation_from_axis()
        self.f_x = torch.zeros(2)
        self.g_y = torch.zeros(grid**2)
        self.labels = torch.zeros_like(self.g_y)
        self.solver = OT_solver(n_sinkhorn=25, cost_function=l2_cost,
                                cost_params=dict(scaling="volume", R=math.sqrt(area/math.pi), C=0.1))

    def orientation_from_axis(self):
        # Isotropic cost and unit aspect ratio for every cell in this experiment.
        return torch.eye(2).expand(len(self.axis), 2, 2)

    def lazy_XY(self):
        return LazyTensor(self.y[None, :, :]) - LazyTensor(self.x[:, None, :])

    def allocation_matrix(self):
        ids = torch.arange(self.N_cells, dtype=self.x.dtype)
        return (-(LazyTensor(ids[:, None, None]) - LazyTensor(self.labels[None, :, None])).abs()).step()

    def solve(self):
        force = self.solver.lloyd_step(self, tau=(self.volumes[:-1]/math.pi).rsqrt(),
                                      max_epoch=3, tol=0.02)
        labels = self.labels.int().numpy().reshape(self.grid, self.grid)
        return force, labels

    def shape_axes(self, labels):
        ratios = []
        for i in range(self.N_cells):
            pixels = np.column_stack(np.where(labels == i))
            if len(pixels) < 3:
                raise ValueError(f"Cell {i} unresolved on grid")
            eig, vec = np.linalg.eigh(np.cov(pixels.T))
            direction = torch.tensor(vec[:, -1], dtype=self.x.dtype)
            if eig[1] > eig[0] * 1.00001:
                self.axis[i] = direction if direction @ self.axis[i] >= 0 else -direction
            ratios.append(np.sqrt(eig[1] / eig[0]))
        return np.array(ratios)
