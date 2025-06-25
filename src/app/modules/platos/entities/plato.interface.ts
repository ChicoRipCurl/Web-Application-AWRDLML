export interface Insumo {
    nombre: string;
    cantidadPorPorcion: number;
    unidad: 'kg' | 'g' | 'unid';
    pesoAprox?: number;
}

export interface Plato {
    id: string;
    usuarioId: string;
    nombre: string;
    insumos: Insumo[];
}