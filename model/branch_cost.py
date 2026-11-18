"""Cost and site gradient for a core with curved one-sided arms."""
import numpy as np
from tissue import LazyTensor, torch


def native_cost(grid, sites, coeff, arms):
    def per_cell(a):
        return LazyTensor(torch.as_tensor(a,dtype=sites.dtype)[:, None, None].contiguous())
    dx=LazyTensor(grid[None,:,:])-LazyTensor(sites[:,None,:])
    u,v=dx[:,:,0],dx[:,:,1]
    xx,xy,yy=coeff.T
    base=per_cell(xx)*u*u + per_cell(2*xy)*u*v + per_cell(yy)*v*v
    cost=base
    for j in range(max(map(len,arms))):
        values=[row[j] if j<len(row) else None for row in arms]
        def col(key):
            return per_cell([a[key] if a else 0 for a in values])
        z=col('ex')*u+col('ey')*v
        side=col('ex')*v-col('ey')*u-col('bend')*z*z
        active=per_cell([1 if a else -1 for a in values])
        candidate=col('axial')*z*z+col('lateral')*side*side
        eligible=active.ifelse(z.ifelse(candidate,base),base)
        cost=cost-(cost-eligible).relu()
    return cost


def advance(sites, grid, mask, coeff, arms, centres, mobility):
    for i, row in enumerate(arms):
        delta=grid[mask.ravel()==i]-sites[i] if row else centres[i:i+1]-sites[i]
        u,v=delta.T
        xx,xy,yy=coeff[i]
        gx,gy=xx*u+xy*v,xy*u+yy*v
        lowest=gx*u+gy*v
        for a in row:
            z=a['ex']*u+a['ey']*v
            b=a['ex']*v-a['ey']*u-a['bend']*z*z
            val=a['axial']*z*z+a['lateral']*b*b
            hit=(z>=0)&(val<lowest)
            gs=a['lateral']*b[hit]
            ga=a['axial']*z[hit]-2*a['bend']*z[hit]*gs
            gx[hit]=ga*a['ex']-gs*a['ey']
            gy[hit]=ga*a['ey']+gs*a['ex']
            lowest[hit]=val[hit]
        sites[i]+=mobility[i]*np.array([gx.mean(),gy.mean()])
