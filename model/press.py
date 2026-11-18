"""Run the chamber experiment with ICeShOT's native CPU solver."""
import argparse
import contextlib
import json
import os
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from scipy import ndimage
from tissue import LazyTensor, torch
from vendor.tissue_ot import LBFGSB, OT_solver

WIDTH, HEIGHT = 9., 6.
NX, NY = 168, 112


def measurements(labels, grid, areas, width):
    n = len(areas)
    ids = labels.ravel()
    valid = ids < n
    count = np.bincount(ids[valid], minlength=n)
    assert count.min() > 0
    points = grid.numpy()[valid].astype(float)
    centres = np.stack([np.bincount(ids[valid], weights=v, minlength=n)/count
                        for v in points.T], axis=1)
    aspect = []
    largest_fragment = 0.
    for i, centre in enumerate(centres):
        centred = points[ids[valid] == i]-centre
        eigenvalues = np.linalg.eigvalsh(centred.T@centred/count[i])
        aspect.append(np.sqrt(eigenvalues[1]/eigenvalues[0]))
        components, number = ndimage.label(labels == i)
        if number > 1:
            sizes = np.bincount(components.ravel())[1:]
            largest_fragment = max(largest_fragment, 1-sizes.max()/sizes.sum())
    edges = np.zeros(n*n, dtype=int)
    for left, right in [(labels[:-1],labels[1:]), (labels[:,:-1],labels[:,1:])]:
        use = (left!=right)&(left<n)&(right<n)
        key = np.minimum(left[use], right[use])*n+np.maximum(left[use], right[use])
        edges += np.bincount(key,minlength=n*n)
    error = np.max(np.abs(count*width*HEIGHT/(NX*NY)/areas-1))
    return dict(centres=centres.round(6).tolist(), aspect=np.round(aspect,6).tolist(),
                contacts=np.flatnonzero(edges>=4).tolist(), maxError=round(float(error),6),
                fragmentFraction=round(float(largest_fragment),6))


def run(spec):
    material = spec['material']
    sites = torch.tensor([[c['x'],c['y']] for c in material])
    area = np.array([c['area'] for c in material])
    coeff = torch.tensor([[c['xx'],2*c['xy'],c['yy']] for c in material])
    f = torch.tensor([c['area']*c['k']/np.pi for c in material]+[0.],dtype=torch.float32)
    y, x = torch.meshgrid((torch.arange(NY)+.5)/NY,(torch.arange(NX)+.5)/NX,indexing='ij')
    tensor_coeff = LazyTensor(coeff[:,None,:])
    solver = OT_solver()
    frames = []
    g_y = torch.zeros(NX*NY)
    labels = torch.zeros_like(g_y)
    for entry in [None]*120+spec['schedule']:
        width = WIDTH if entry is None else entry['width']
        grid = torch.column_stack([((WIDTH-width)/2+width*x).flatten(),(HEIGHT*y).flatten()])
        delta = LazyTensor(grid[None,:,:])-LazyTensor(sites[:,None,:])
        u,v = delta[:,:,0],delta[:,:,1]
        cost = ((u*u).concat(u*v).concat(v*v)*tensor_coeff).sum(-1)
        fraction = area/(width*HEIGHT)
        targets = torch.tensor(np.r_[fraction,1-fraction.sum()],dtype=torch.float32)
        LBFGSB(cost,range(22),f,g_y,a=targets,max_epoch=3,tol=.004)
        state = SimpleNamespace(x=sites, y=grid, f_x=f, labels=labels)
        solver.Laguerre_allocation(state,cost)
        mask = labels.numpy().astype(int).reshape(NY,NX)
        if entry is None:
            keep = mask.ravel()<len(area)
            ids = mask.ravel()[keep]
            n = np.bincount(ids,minlength=len(area))
            centres = np.stack([np.bincount(ids,weights=v)/n for v in grid.numpy()[keep].T],axis=1)
        else:
            m = measurements(mask,grid,area,width)
            frames.append(dict(**entry,**m,sites=sites.numpy().round(7).tolist(),
                               f=f[:-1].numpy().round(7).tolist()))
            centres = np.array(m['centres'])
        offset = torch.as_tensor(centres,dtype=sites.dtype)-sites
        xx,xy2,yy = coeff.T
        du,dv = offset.T
        sites += .17*torch.stack([xx*du+.5*xy2*dv,.5*xy2*du+yy*dv],dim=1)
    return dict(cfg=spec['cfg'],material=material,frames=frames,backend='native')


if __name__=='__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('spec',type=Path)
    cli.add_argument('result',type=Path)
    args = cli.parse_args()
    torch.set_num_threads(1)
    with open(os.devnull,'w') as quiet, contextlib.redirect_stdout(quiet):
        result = run(json.loads(args.spec.read_text()))
    args.result.write_text(json.dumps(result,separators=(',',':')))
    fs = result['frames']
    print('frames',len(fs),'initial contacts',len(fs[0]['contacts']),'final',len(fs[-1]['contacts']),
          'worst area error',max(f['maxError'] for f in fs),'largest detached fraction',max(f['fragmentFraction'] for f in fs))
