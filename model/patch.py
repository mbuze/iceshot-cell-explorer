import numpy as np
import torch
from tissue import Tissue, LazyTensor
from vendor.tissue_ot import LBFGSB

SIDE = 7

class Patch(Tissue):
    def __init__(self, seed, grid):
        super().__init__(grid, .02)
        rng = np.random.default_rng(seed + 9213)
        self.y *= SIDE
        self.xy = self.y.numpy()
        sites = np.indices((SIDE, SIDE)).reshape(2,-1).T.astype(float) + .5
        sites += rng.uniform(-.25, .25, sites.shape)
        sites[[0, 24]] = sites[[24, 0]]
        self.x = torch.tensor(sites, dtype=torch.float32)
        self.rest = self.x.numpy().copy()
        self.N_cells = len(sites)
        weights = rng.uniform(.82, 1.18, len(sites))
        self.volumes = torch.tensor(np.r_[weights/weights.sum(), 0], dtype=torch.float32)
        # A filled domain: zero target void, positive common offset for the free potentials.
        self.f_x = torch.full((len(sites)+1,), 6.)
        self.f_x[-1] = 0.
        self.pigment = torch.zeros(len(sites), 1, 1)
        self.pigment[0] = 1.
        self.target = self.volumes.numpy()[:-1] * grid**2

    def allocate(self, pigment_cost):
        base = (self.lazy_XY()**2).sum(-1)
        delta = pigment_cost - ((self.xy-self.x[0].numpy())**2).sum(1)
        cost = base + LazyTensor(self.pigment) * LazyTensor(torch.from_numpy(
            delta.astype('float32'))[None,:,None])
        LBFGSB(cost, range(14), self.f_x, self.g_y, a=self.volumes,
               max_epoch=2, tol=.015)
        self.solver.Laguerre_allocation(self, cost)
        labels = self.labels.numpy().astype(np.int16).reshape(self.grid,self.grid)
        n = np.bincount(labels.ravel(), minlength=self.N_cells)
        if len(n) != self.N_cells or np.min(n) == 0:
            raise RuntimeError("Empty cell or unallocated pixel in filled patch")
        centers = np.column_stack([np.bincount(labels.ravel(), weights=y)/n for y in self.xy.T])
        err = abs(n/self.target-1)
        return labels, centers, err

    def relax_hosts(self, centers):
        x = self.x.numpy()
        x[1:] += .22*(centers[1:] - x[1:]) + .014*(self.rest[1:] - x[1:])


