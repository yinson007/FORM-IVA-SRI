export interface FormField {
    id: string;
    description?: string;
    isTotal?: boolean;
    note?: string;
}

export interface FormRow {
    description: string;
    fields: (FormField | null)[];
    isHeader?: boolean;
    isTitle?: boolean;
    isAccordion?: boolean;
    isTotal?: boolean;
    note?: string;
}

export interface FormSection {
    title: string;
    range: string;
    rows: FormRow[];
}

export const formStructure: FormSection[] = [
    {
        title: "Ventas y Operaciones",
        range: "400",
        rows: [
            { description: "RESUMEN DE VENTAS Y OTRAS OPERACIONES DEL PERIODO QUE DECLARA", isAccordion: true, fields: [] },
            { description: "", isHeader: true, fields: [{ id: 'valorBruto', description: "VALOR BRUTO" }, { id: 'valorNeto', description: "VALOR NETO" }, { id: 'impuestoGenerado', description: "IMPUESTO GENERADO" }] },
            { description: "Ventas locales (excluye activos fijos) gravadas tarifa diferente de cero", fields: [{ id: "401" }, { id: "411" }, { id: "421" }] },
            { description: "Ventas de activos fijos gravadas tarifa diferente de cero", fields: [{ id: "402" }, { id: "412" }, { id: "422" }] },
            { description: "Ventas locales (excluye activos fijos) gravadas tarifa diferente de cero (TARIFA VARIABLE)", fields: [{ id: "410" }, { id: "420" }, { id: "430" }] },
            { description: "Ventas locales (excluye activos fijos) gravadas tarifa 5%", fields: [{ id: "425" }, { id: "435" }, { id: "445" }] },
            { description: "IVA generado en la diferencia entre ventas y notas de crédito con distinta tarifa (ajuste a pagar)", fields: [null, null, { id: "423" }] },
            { description: "IVA generado en la diferencia entre ventas y notas de crédito con distinta tarifa (ajuste a favor)", fields: [null, null, { id: "424" }] },
            { description: "Ventas locales (excluye activos fijos) gravadas tarifa 0% que no dan derecho a crédito tributario", fields: [{ id: "403" }, { id: "413" }, null] },
            { description: "Ventas de activos fijos gravadas tarifa 0% que no dan derecho a crédito tributario", fields: [{ id: "404" }, { id: "414" }, null] },
            { description: "Ventas locales (excluye activos fijos) gravadas tarifa 0% que dan derecho a crédito tributario", fields: [{ id: "405" }, { id: "415" }, null] },
            { description: "Ventas de activos fijos gravadas tarifa 0% que dan derecho a crédito tributario", fields: [{ id: "406" }, { id: "416" }, null] },
            { description: "Exportaciones de bienes", fields: [{ id: "407" }, { id: "417" }, null] },
            { description: "Exportaciones de servicios y/o derechos", fields: [{ id: "408" }, { id: "418" }, null] },
            { description: "TOTAL VENTAS Y OTRAS OPERACIONES", isTotal: true, fields: [{ id: "409" }, { id: "419" }, { id: "429" }] },
            { description: "Transferencias de bienes y prestación de servicios no objeto o exentos de IVA", fields: [{ id: "431" }, { id: "441" }, null] },
            { description: "Notas de crédito tarifa 0% por compensar próximo mes", fields: [null, { id: "442" }, null] },
            { description: "Notas de crédito tarifa diferente de cero por compensar próximo mes", fields: [null, { id: "443" }, { id: "453" }] },
            { description: "Ingresos por reembolso como intermediario (informativo)", fields: [{ id: "434" }, { id: "444" }, { id: "454" }] },
            
            { description: "LIQUIDACIÓN DEL IVA EN EL MES", isAccordion: true, fields: [] },
            { description: "Total transferencias gravadas tarifa diferente de cero a contado este mes", fields: [null, null, { id: "480" }] },
            { description: "Total transferencias gravadas tarifa diferente de cero a crédito este mes", fields: [null, null, { id: "481" }] },
            { description: "Total impuesto generado", note: "(trasládese campo 429)", fields: [null, null, { id: "482" }] },
            { description: "Impuesto a liquidar del mes anterior", note: "(verificar ventas a crédito de periodos anteriores)", fields: [null, null, { id: "483" }] },
            { description: "Impuesto a liquidar en este mes", fields: [null, null, { id: "484" }] },
            { description: "Impuesto a liquidar en el próximo mes", note: "(482-484)", fields: [null, null, { id: "485" }] },
            { description: "Mes a pagar el monto de IVA diferente de cero por ventas a crédito de este mes", fields: [null, null, { id: "486" }] },
            { description: "Tamaño COPCI", fields: [null, null, { id: "487" }] },
            { description: "TOTAL IMPUESTO A LIQUIDAR EN ESTE MES", isTotal: true, note: "(483+484)", fields: [null, null, { id: "499" }] },
        ]
    },
    {
        title: "Adquisiciones y Pagos",
        range: "500",
        rows: [
            { description: "RESUMEN DE ADQUISICIONES Y PAGOS DEL PERÍODO QUE DECLARA", isAccordion: true, fields: [] },
            { description: "", isHeader: true, fields: [{ id: 'valorBruto', description: "VALOR BRUTO" }, { id: 'valorNeto', description: "VALOR NETO" }, { id: 'impuestoGenerado', description: "IMPUESTO GENERADO" }] },
            { description: "Adquisiciones y pagos (excluye activos fijos) gravados tarifa diferente de cero (con derecho a crédito tributario)", fields: [{ id: "500" }, { id: "510" }, { id: "520" }] },
            { description: "Adquisiciones locales de activos fijos gravados tarifa diferente de cero (con derecho a crédito tributario)", fields: [{ id: "501" }, { id: "511" }, { id: "521" }] },
            { description: "Adquisiciones y pagos (excluye activos fijos) gravados tarifa diferente de cero (con derecho a crédito tributario tarifa variable)", fields: [{ id: "530" }, { id: "533" }, { id: "534" }] },
            { description: "Adquisiciones y pagos locales (excluye activos fijos) gravados con tarifa 5% (con derecho a crédito tributario)", fields: [{ id: "540" }, { id: "550" }, { id: "560" }] },
            { description: "Otras adquisiciones y pagos gravados tarifa diferente de cero (sin derecho a crédito tributario)", fields: [{ id: "502" }, { id: "512" }, { id: "522" }] },
            { description: "Importaciones de servicios y/o derechos gravados tarifa diferente de cero", fields: [{ id: "503" }, { id: "513" }, { id: "523" }] },
            { description: "Importaciones de bienes (excluye activos fijos) gravados tarifa diferente de cero", fields: [{ id: "504" }, { id: "514" }, { id: "524" }] },
            { description: "Importaciones de activos fijos gravados tarifa diferente de cero", fields: [{ id: "505" }, { id: "515" }, { id: "525" }] },
            { description: "IVA generado en la diferencia entre adquisiciones y notas de crédito con distinta tarifa (ajuste en positivo al crédito tributario)", fields: [null, null, { id: "526" }] },
            { description: "IVA generado en la diferencia entre adquisiciones y notas de crédito con distinta tarifa (ajuste en negativo al crédito tributario)", fields: [null, null, { id: "527" }] },
            { description: "Importaciones de bienes (incluye activos fijos) gravados tarifa 0%", fields: [{ id: "506" }, { id: "516" }, null] },
            { description: "Adquisiciones y pagos (incluye activos fijos) gravados tarifa 0%", fields: [{ id: "507" }, { id: "517" }, null] },
            { description: "Adquisiciones realizadas a contribuyentes RISE (hasta diciembre 2021), NEGOCIOS POPULARES (desde enero 2022)", fields: [{ id: "508" }, { id: "518" }, null] },
            { description: "TOTAL ADQUISICIONES Y PAGOS", isTotal: true, fields: [{ id: "509" }, { id: "519" }, { id: "529" }] },
            { description: "Adquisiciones no objeto de IVA", fields: [{ id: "531" }, { id: "541" }, null] },
            { description: "Adquisiciones exentas del pago de IVA", fields: [{ id: "532" }, { id: "542" }, null] },
            { description: "Notas de crédito tarifa 0% por compensar próximo mes", fields: [null, { id: "543" }, null] },
            { description: "Notas de crédito tarifa diferente de cero por compensar próximo mes", fields: [null, { id: "544" }, { id: "554" }] },
            { description: "Pagos netos por reembolso como intermediario / valores facturados por socios a operadoras de transporte / pagos realizados por parte de las sociedades de gestión colectiva como intermediarios (informativo)", fields: [{ id: "535" }, { id: "545" }, { id: "555" }] },
            { description: "Factor de proporcionalidad para crédito tributario", note: "(411+412+420+435+415+416+417+418) / 419", fields: [null, null, { id: "563" }] },
            { description: "Crédito tributario aplicable en este período (de acuerdo al factor de proporcionalidad o a su contabilidad)", note: "(520+521+534+560+523+524+525+526-527) x 563", fields: [null, null, { id: "564" }] },
            { description: "Valor de IVA no considerado como crédito tributario por factor de proporcionalidad", fields: [null, null, { id: "565" }] },
            { description: "", fields: [null, null, null] },
            { description: "Total comprobantes de venta recibidos por adquisiciones y pagos (excepto notas de venta)", fields: [{ id: "115" }, null, null] },
            { description: "Total notas de venta recibidas", fields: [{ id: "117" }, null, null] },
            { description: "Total liquidaciones de compra emitidas (por pagos tarifa 0% de IVA, o por reembolsos en relación de dependencia)", fields: [{ id: "119" }, null, null] },
        ]
    },
    {
        title: "Resumen Impositivo",
        range: "600",
        rows: [
            { description: "RESUMEN IMPOSITIVO: AGENTE DE PERCEPCIÓN DEL IMPUESTO AL VALOR AGREGADO", isAccordion: true, fields: [] },
            { description: "", isHeader: true, fields: [null, null, { id: 'valorUnico', description: "VALOR" }] },
            { description: "Impuesto causado", note: "(si la diferencia de los campos 499-564 es mayor que cero)", fields: [null, null, { id: "601" }] },
            { description: "Crédito tributario aplicable en este período", note: "(si la diferencia de los campos 499-564 es menor que cero)", fields: [null, null, { id: "602" }] },
            { description: "(-) Compensación de IVA por ventas efectuadas con medio electrónico y/o IVA devuelto o descontado por transacciones realizadas con personas adultas mayores o personas con discapacidad", fields: [null, null, { id: "603" }] },
            { description: "(-) Compensación de IVA por ventas efectuadas en zonas afectadas - Ley de solidaridad, restitución de crédito tributario en resoluciones administrativas o sentencias judiciales de última instancia", fields: [null, null, { id: "604" }] },
            { description: "(-) Saldo crédito tributario del mes anterior: Por adquisiciones e importaciones", note: "(trasládese el campo 615 de la declaración del período anterior)", fields: [null, null, { id: "605" }] },
            { description: "(-) Saldo crédito tributario del mes anterior: Por retenciones en la fuente de IVA que le han sido efectuadas", note: "(trasládese el campo 617 de la declaración del período anterior)", fields: [null, null, { id: "606" }] },
            { description: "(-) Saldo crédito tributario del mes anterior: Por compensación de IVA por ventas efectuadas con medio electrónico", note: "(trasládese el campo 618 de la declaración del período anterior)", fields: [null, null, { id: "607" }] },
            { description: "(-) Saldo crédito tributario del mes anterior: Por compensación de IVA por ventas efectuadas en zonas afectadas - Ley de solidaridad", note: "(trasládese el campo 619 de la declaración del período anterior)", fields: [null, null, { id: "608" }] },
            { description: "(-) Saldo crédito tributario del mes anterior: Por procesos de fusión o absorción de sociedades", fields: [null, null, { id: "623" }] },
            { description: "(-) Retenciones en la fuente de IVA que le han sido efectuadas en este período", fields: [null, null, { id: "609" }] },
            { description: "(-) IVA devuelto o descontado por transacciones realizadas con personas adultas mayores o personas con discapacidad", fields: [null, null, { id: "622" }] },
            { description: "(+) Ajuste por IVA devuelto o descontado por adquisiciones efectuadas con medio electrónico", fields: [null, null, { id: "610" }] },
            { description: "(+) Ajuste por IVA devuelto o descontado en adquisiciones efectuadas en zonas afectadas - Ley de solidaridad", fields: [null, null, { id: "611" }] },
            { description: "(+) Ajuste por IVA devuelto e IVA rechazado (por concepto de devoluciones de IVA), ajuste de IVA por procesos de control y otros (adquisiciones en importaciones), imputables al crédito tributario", fields: [null, null, { id: "612" }] },
            { description: "(+) Ajuste por IVA devuelto e IVA rechazado, ajuste de IVA por procesos de control y otros (por concepto retenciones en la fuente de IVA), imputables al crédito tributario", fields: [null, null, { id: "613" }] },
            { description: "(+) Ajuste por IVA devuelto por otras instituciones del sector público imputable al crédito tributario en el mes", fields: [null, null, { id: "614" }] },
            { description: "Saldo crédito tributario para el próximo mes: Por adquisiciones e importaciones", fields: [null, null, { id: "615" }] },
            { description: "Saldo crédito tributario para el próximo mes: Por retenciones en la fuente de IVA que le han sido efectuadas", fields: [null, null, { id: "617" }] },
            { description: "Saldo crédito tributario para el próximo mes: Por compensación de IVA por ventas efectuadas con medio electrónico", fields: [null, null, { id: "618" }] },
            { description: "Saldo crédito tributario para el próximo mes: Por compensación de IVA por ventas efectuadas en zonas afectadas - Ley de solidaridad", fields: [null, null, { id: "619" }] },
            { description: "IVA pagado y no compensado, en la adquisición local o importación de bienes o servicios que se carga al gasto de Impuesto a la Renta.", fields: [null, null, { id: "624" }] },
            { description: "Ajuste del crédito tributario de Impuesto al Valor Agregado pagado en adquisiciones locales e importaciones de bienes y servicios superior a cinco (5) años", fields: [null, null, { id: "625" }] },
            { description: "SUBTOTAL A PAGAR", isTotal: true, note: "Si (601-602-603-604-605-606-607-608-609-622-623+610+611+612+613+614) > 0", fields: [null, null, { id: "620" }] },
            { description: "IVA PRESUNTIVO DE SALAS DE JUEGO (BINGO MECÁNICOS) Y OTROS JUEGOS DE AZAR", fields: [null, null, { id: "621" }] },
            { description: "TOTAL IMPUESTO A PAGAR POR PERCEPCIÓN Y RETENCIONES EFECTUADAS EN VENTAS (varios porcentajes)", isTotal: true, note: "(620+621)", fields: [null, null, { id: "699" }] },
        ]
    },
    {
        title: "Retenciones y Divisas",
        range: "700",
        rows: [
            { description: "IMPUESTO A LA SALIDA DE DIVISAS A EFECTOS DE DEVOLUCIÓN A EXPORTADORES HABITUALES DE BIENES", isAccordion: true, fields: [] },
            { description: "", isHeader: true, fields: [{ id: 'valor', description: "VALOR" }, { id: 'isd', description: "ISD PAGADO" }, { id: 'porcentaje', description: "PORCENTAJE" }] },
            { description: "Importaciones de materias primas, insumos y bienes de capital que sean incorporadas en procesos productivos de bienes que se exporten", fields: [{ id: "700" }, { id: "701" }, null] },
            { description: "Proporción del ingreso neto de divisas desde el exterior al Ecuador, respecto del total de las exportaciones netas de bienes", fields: [null, null, { id: "702" }] },

            { description: "AGENTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO", isAccordion: true, fields: [] },
            { description: "", isHeader: true, fields: [null, null, { id: 'valorUnico', description: "VALOR" }] },
            { description: "Retención del 10%", fields: [null, null, { id: "721" }] },
            { description: "Retención del 20%", fields: [null, null, { id: "723" }] },
            { description: "Retención del 30%", fields: [null, null, { id: "725" }] },
            { description: "Retención del 50%", fields: [null, null, { id: "727" }] },
            { description: "Retención del 70%", fields: [null, null, { id: "729" }] },
            { description: "Retención del 100%", fields: [null, null, { id: "731" }] },
            { description: "TOTAL IMPUESTO RETENIDO", isTotal: true, note: "(721+723+725+727+729+731)", fields: [null, null, { id: "799" }] },
            { description: "Devolución provisional de IVA mediante compensación con retenciones efectuadas", fields: [null, null, { id: "800" }] },
            { description: "Retenciones efectuadas y no pagadas sector público, universidades y escuelas politécnicas", fields: [null, null, { id: "802" }] },
            { description: "TOTAL IMPUESTO A PAGAR POR RETENCIÓN", isTotal: true, note: "(799-800-802)", fields: [null, null, { id: "801" }] },
        ]
    },
    {
        title: "Valores a Pagar",
        range: "800",
        rows: [
            { description: "VALORES A PAGAR", isTitle: true, fields: [] },
            { description: "", isHeader: true, fields: [null, null, { id: 'valorUnico', description: "VALOR" }] },
            { description: "TOTAL CONSOLIDADO DE IMPUESTO AL VALOR AGREGADO", note: "(699+801)", fields: [null, null, { id: "859" }] },
            { description: "Pago previo", fields: [null, null, { id: "890" }] },
            
            { description: "Detalle de imputación al pago (para declaraciones sustitutivas)", isAccordion: true, fields: [] },
            { description: "Interés", fields: [null, null, { id: "897" }] },
            { description: "Impuesto", fields: [null, null, { id: "898" }] },
            { description: "Multa", fields: [null, null, { id: "899" }] },

            { description: "Pago directo en cuenta única del tesoro nacional (uso exclusivo para instituciones y empresas del sector público autorizadas)", fields: [null, null, { id: "880" }] },

            { description: "Pago diferido IVA por emergencia sanitaria COVID-19", isAccordion: true, fields: []},
            { description: "¿Tiene derecho al pago diferido del IVA a pagar de este ejercicio fiscal conforme al Decreto 1021 del 2020?", fields: [null, null, {id: "881"}] },
            { description: "Cuota 1 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (10%)", fields: [null, null, {id: "882"}] },
            { description: "Cuota 2 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (10%)", fields: [null, null, {id: "883"}] },
            { description: "Cuota 3 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (20%)", fields: [null, null, {id: "884"}] },
            { description: "Cuota 4 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (20%)", fields: [null, null, {id: "885"}] },
            { description: "Cuota 5 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (20%)", fields: [null, null, {id: "886"}] },
            { description: "Cuota 6 del Impuesto al Valor Agregado del ejercicio fiscal 2020 (20%)", fields: [null, null, {id: "887"}] },

            { description: "Valores a Pagar (luego de imputación)", isAccordion: true, fields: []},
            { description: "TOTAL IMPUESTO A PAGAR", isTotal: true, note: "(859-898)", fields: [null, null, { id: "902" }] },
            { description: "Interés por mora", fields: [null, null, { id: "903" }] },
            { description: "Multa", fields: [null, null, { id: "904" }] },

            { description: "TOTAL PAGADO", isTotal: true, fields: [null, null, { id: "999" }] },
        ]
    }
];