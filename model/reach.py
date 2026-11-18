"""Repeat the shape experiment with ICeShOT's CPU dual solver and allocator."""
import argparse
import contextlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
import numpy as np
from press import HEIGHT, WIDTH, NX, NY, measurements
from tissue import torch
from branch_cost import advance, native_cost
from vendor.tissue_ot import OT_solver, LBFGSB


def run(spec):
    material=spec['base']['cells']
    sites=np.array([[c['x'],c['y']] for c in material])
    areas=np.array([c['area'] for c in material])
    weights=torch.tensor([*spec['base']['weights'],0.],dtype=torch.float32)
    gy=torch.zeros(NX*NY)
    y,x=torch.meshgrid((torch.arange(NY)+.5)/NY,(torch.arange(NX)+.5)/NX,indexing='ij')
    solver=OT_solver()
    for j,step in enumerate(spec['steps']):
        width=step['width']
        grid=torch.stack([((WIDTH-width)/2+x*width).flatten(),(y*HEIGHT).flatten()],dim=1)
        frac=areas/(width*HEIGHT)
        target=torch.as_tensor(np.r_[frac,1-frac.sum()],dtype=torch.float32)
        previous=weights.clone()
        site_tensor=torch.tensor(sites,dtype=torch.float32)
        for attempt in step['attempts']:
            weights.copy_(previous)
            coeff=np.array([r[:3] for r in attempt['costs']])
            arms=[r[3] for r in attempt['costs']]
            cost=native_cost(grid,site_tensor,coeff,arms)
            LBFGSB(cost,range(24),weights,gy,a=target,max_epoch=3,tol=.004)
            state=SimpleNamespace(x=site_tensor,y=grid,f_x=weights,labels=torch.zeros_like(gy))
            solver.Laguerre_allocation(state,cost)
            labels=state.labels.numpy().astype(int).reshape(NY,NX)
            m=measurements(labels,grid,areas,width,min_edges=5)
            if m['fragmentFraction']<=.008 and m['maxError']<=.04: break
        else:
            raise RuntimeError('no accepted allocation')
        if j+1<len(spec['steps']):
            advance(sites,grid.numpy(),labels,coeff,arms,np.array(m['centres']),[.16 if c['type']==1 else .55 for c in material])
    spans=[]
    for i,c in enumerate(material):
        yy,xx=np.where(labels==i)
        spans.append(float(max((np.ptp(xx)+1)*width/NX,(np.ptp(yy)+1)*HEIGHT/NY)))
        c.update(xx=coeff[i,0],xy=coeff[i,1],yy=coeff[i,2],arms=arms[i],x=sites[i,0],y=sites[i,1])
    frame=dict(**m,width=width,applied=attempt['applied'],effectiveStretch=attempt['effectiveStretch'],spans=spans,sites=sites.tolist(),f=weights[:-1].tolist())
    return dict(material=material,frame=frame)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('spec',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    torch.set_num_threads(1)
    with open(os.devnull,'w') as sink,contextlib.redirect_stdout(sink):
        result=run(json.loads(args.spec.read_text()))
    args.output.write_text(json.dumps(result,separators=(',',':')))
