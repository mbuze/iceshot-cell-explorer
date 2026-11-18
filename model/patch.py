import numpy as np
import torch
from tissue import Tissue, LazyTensor
from vendor.tissue_ot import LBFGSB

SIDE = 7

class Patch(Tissue):
    def __init__(self, seed, grid, tissue):
        super().__init__(grid, .02)
        rng = np.random.default_rng(seed + 9213)
        self.y *= SIDE
        self.xy = self.y.numpy()
        sites = np.indices((SIDE, SIDE)).reshape(2,-1).T.astype(float) + .5
        if tissue == "aligned":
            # Four staggered columns produce a sheet of long horizontal cells.
            sites = np.array([[(i + .5 + .14*(-1)**j)*7/4, (j+.5)*7/12]
                              for i in range(4) for j in range(12)] + [[1.65, 3.48]])
        jitter = .42 if tissue == "mixed" else .18
        sites += rng.uniform(-jitter, jitter, sites.shape)
        pigment = np.linalg.norm(sites - [1.65, 3.48], axis=1).argmin()
        sites[[0, pigment]] = sites[[pigment, 0]]
        sites[0] = [1.65, 3.48]
        self.x = torch.tensor(sites, dtype=torch.float32)
        self.rest = self.x.numpy().copy()
        self.N_cells = len(sites)
        weights = rng.uniform(.80, 1.20, len(sites))
        if tissue == "mixed":
            weights = rng.uniform(.56, 1.55, len(sites))**2
        weights[0] = 2.15 * np.mean(weights[1:])
        self.metric = np.array([1/2.8, 2.8] if tissue == "aligned" else [1., 1.],
                               dtype=np.float32)
        self.metric_sqrt = torch.from_numpy(np.sqrt(self.metric))
        self.scaled_grid = LazyTensor((self.y*self.metric_sqrt)[None,:,:])
        self.volumes = torch.tensor(np.r_[weights/weights.sum(), 0], dtype=torch.float32)
        # A filled domain: zero target void, positive common offset for the free potentials.
        self.f_x = torch.full((len(sites)+1,), 6.)
        self.f_x[-1] = 0.
        self.pigment = torch.zeros(len(sites), 1, 1)
        self.pigment[0] = 1.
        self.target = self.volumes.numpy()[:-1] * grid**2

    def allocate(self, pigment_cost):
        offset = self.scaled_grid - LazyTensor((self.x*self.metric_sqrt)[:,None,:])
        base = (offset**2).sum(-1)
        delta = pigment_cost - (((self.xy-self.x[0].numpy())**2)*self.metric).sum(1)
        cost = base + LazyTensor(self.pigment) * LazyTensor(torch.from_numpy(
            delta.astype('float32'))[None,:,None])
        LBFGSB(cost, range(22), self.f_x, self.g_y, a=self.volumes,
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
        x[1:] += .52*(centers[1:] - x[1:]) + .003*(self.rest[1:] - x[1:])


