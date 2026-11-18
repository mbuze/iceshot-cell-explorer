"""Division helpers from the ICeShOT TissueGrowth gallery (MIT license)."""
import torch

def insert(x,ind,elem1,elem2):
    sh = list(x.shape)
    sh[0] += 1
    new_x = torch.zeros(sh)
    new_x[:ind] = x[:ind]
    new_x[(ind+2):] = x[(ind+1):]
    new_x[ind] = elem1
    new_x[ind+1] = elem2
    return new_x

def sample_unit(N,d):
    x = torch.randn((N,d))
    x /= torch.norm(x,dim=1).reshape((N,1))
    return x
def divide(simu,ind,R1):
    simu.x = insert(simu.x,ind,simu.x[ind]-0.5*R1*simu.axis[ind],simu.x[ind]+0.5*R1*simu.axis[ind])
    simu.axis = insert(simu.axis,ind,sample_unit(1,simu.d),sample_unit(1,simu.d))
    simu.ar = insert(simu.ar,ind,1.0,1.0)
    simu.orientation = simu.orientation_from_axis()
    simu.N_cells += 1
    simu.volumes = insert(simu.volumes,ind,0.5*simu.volumes[ind],0.5*simu.volumes[ind])
    simu.f_x = insert(simu.f_x,ind,simu.f_x[ind],simu.f_x[ind])
