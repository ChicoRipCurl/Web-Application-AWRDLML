import {CompraInsumo} from "./insumoCompra.interface";

export interface Compra {
    id: string;
    usuarioId: string;
    fecha: string;
    insumos: CompraInsumo[];
}