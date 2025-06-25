export interface Venta {
    id: string;
    usuarioId: string;
    fecha: string;
    platoId: string;
    plato?: string;
    cantidad: number;
}

