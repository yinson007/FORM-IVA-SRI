
export interface WithholdingField {
    id: string; // Casillero ID (e.g., '303')
}

export interface WithholdingRow {
    description: string;
    baseField?: WithholdingField | null; // Columna Base Imponible
    retentionField?: WithholdingField | null; // Columna Valor Retenido
    isHeader?: boolean;
    isTotal?: boolean;
    isTitle?: boolean;
}

export const withholdingStructure: WithholdingRow[] = [
    { description: "DERIVADAS DEL TRABAJO Y SERVICIOS PRESTADOS", isTitle: true },
    { description: "En relación de dependencia que supera o no la base desgravada", baseField: { id: "302" }, retentionField: { id: "352" } },
    { description: "Servicios - Honorarios profesionales", baseField: { id: "303" }, retentionField: { id: "353" } },
    { description: "Servicios profesionales prestados por sociedades residentes", baseField: { id: "3030" }, retentionField: { id: "3530" } }, // Note: Using 4 digit variant if exists or fallback
    { description: "Predomina el intelecto", baseField: { id: "304" }, retentionField: { id: "354" } },
    { description: "Predomina la mano de obra", baseField: { id: "307" }, retentionField: { id: "357" } },
    { description: "Utilización o aprovechamiento de la imagen o renombre (personas naturales, sociedades, influencers)", baseField: { id: "308" }, retentionField: { id: "358" } },
    { description: "Publicidad y comunicación", baseField: { id: "309" }, retentionField: { id: "359" } },
    { description: "Transporte privado de pasajeros o servicio público o privado de carga", baseField: { id: "310" }, retentionField: { id: "360" } },
    { description: "A través de liquidaciones de compra (nivel cultural o rusticidad)", baseField: { id: "311" }, retentionField: { id: "361" } },

    { description: "POR BIENES Y SERVICIOS", isTitle: true },
    { description: "Transferencia de bienes muebles de naturaleza corporal", baseField: { id: "312" }, retentionField: { id: "362" } },
    { description: "Seguros y reaseguros (primas y cesiones)", baseField: { id: "322" }, retentionField: { id: "372" } },
    { description: "COMPRAS AL PRODUCTOR: de bienes de origen agrícola, avícola, pecuario, apícola, cunícola, bioacuático, forestal y carnes en estado natural", baseField: { id: "3120" }, retentionField: { id: "3620" } },
    { description: "COMPRAS AL COMERCIALIZADOR: de bienes de origen agrícola, avícola, pecuario, apícola, cunícola, bioacuático, forestal y carnes en estado natural", baseField: { id: "3121" }, retentionField: { id: "3621" } },
    { description: "Actividades de construcción de obra material inmueble, urbanización, lotización o actividades similares", baseField: { id: "3430" }, retentionField: { id: "3450" } },
    { description: "Pagos aplicables el 1% (Energía Eléctrica y régimen RIMPE - Emprendedores)", baseField: { id: "343" }, retentionField: { id: "393" } },
    { description: "Pagos aplicables el 2% (incluye Pago local tarjeta de crédito /débito reportada por la Emisora)", baseField: { id: "344" }, retentionField: { id: "394" } },
    { description: "Pagos de bienes y servicios no sujetos a retención o con 0% (distintos de rendimientos financieros)", baseField: { id: "332" }, retentionField: null },

    { description: "POR REGALÍAS, COMISIONES, ARRENDAMIENTOS Y OTROS", isTitle: true },
    { description: "Por regalías, derechos de autor, marcas, patentes y similares", baseField: { id: "314" }, retentionField: { id: "364" } },
    { description: "Comisiones pagadas a sociedades, nacionales o extranjeras residentes en el Ecuador", baseField: { id: "3140" }, retentionField: { id: "3640" } },
    { description: "Arrendamiento Mercantil", baseField: { id: "319" }, retentionField: { id: "369" } },
    { description: "Arrendamiento Bienes inmuebles", baseField: { id: "320" }, retentionField: { id: "370" } },

    { description: "RELACIONADAS CON EL CAPITAL (RENDIMIENTOS, GANANCIAS, DIVIDENDOS Y OTROS)", isTitle: true },
    { description: "Rendimientos financieros", baseField: { id: "323" }, retentionField: { id: "373" } },
    { description: "Rendimientos financieros entre instituciones del sistema financiero y entidades economía popular y solidaria", baseField: { id: "324" }, retentionField: { id: "374" } },
    { description: "Otros Rendimientos financieros 0%", baseField: { id: "3230" }, retentionField: null },
    { description: "Anticipo dividendos", baseField: { id: "325" }, retentionField: { id: "375" } },
    { description: "Dividendos exentos (por no superar la franja exenta o beneficio de otras leyes)", baseField: { id: "3250" }, retentionField: null },
    { description: "Dividendos distribuidos que correspondan al impuesto a la renta único establecido en el art. 27 de la LRTI", baseField: { id: "326" }, retentionField: { id: "376" } },
    { description: "Dividendos distribuidos a personas naturales residentes", baseField: { id: "327" }, retentionField: { id: "377" } },
    { description: "Dividendos distribuidos a sociedades residentes", baseField: { id: "328" }, retentionField: { id: "378" } },
    { description: "Dividendos distribuidos a fideicomisos residentes", baseField: { id: "329" }, retentionField: { id: "379" } },
    { description: "Dividendos en acciones (capitalización de utilidades)", baseField: { id: "331" }, retentionField: null },
    { description: "Ganancia en la enajenación de derechos representativos de capital u otros derechos (bolsa de valores)", baseField: { id: "333" }, retentionField: { id: "383" } },
    { description: "Contraprestación en la enajenación de derechos representativos de capital u otros derechos (no cotizados)", baseField: { id: "334" }, retentionField: { id: "384" } },

    { description: "POR LOTERIAS Y PREMIOS", isTitle: true },
    { description: "Loterías, rifas, apuestas, pronósticos deportivos y similares", baseField: { id: "335" }, retentionField: { id: "385" } },

    { description: "AUTORRETENCIONES Y OTRAS RETENCIONES", isTitle: true },
    { description: "Venta de combustibles - A comercializadoras", baseField: { id: "336" }, retentionField: { id: "386" } },
    { description: "Venta de combustibles - A distribuidores", baseField: { id: "337" }, retentionField: { id: "387" } },
    { description: "Retención a cargo del propio sujeto pasivo por la comercialización de productos forestales", baseField: { id: "3370" }, retentionField: { id: "3870" } },
    { description: "Otras autorretenciones (inciso 1 y 2 Art.92.1 RLRTI)", baseField: { id: "350" }, retentionField: { id: "400" } },
    { description: "Otras retenciones aplicables el 2,75%", baseField: { id: "3440" }, retentionField: { id: "3940" } },
    { description: "Otras retenciones aplicables a otros porcentajes", baseField: { id: "346" }, retentionField: { id: "396" } },

    { description: "LIQUIDACIÓN DE IMPUESTO A LA RENTA ÚNICO", isTitle: true },
    { description: "Impuesto único a la exportación de banano", baseField: { id: "5300" }, retentionField: { id: "3900" } },
    { description: "Producción y venta local de banano producido o no por el mismo sujeto pasivo", baseField: { id: "5100" }, retentionField: { id: "3880" } },
    
    { description: "TOTAL OPERACIONES EFECTUADAS EN EL PAÍS", isTotal: true, baseField: { id: "349" }, retentionField: { id: "399" } },
];
