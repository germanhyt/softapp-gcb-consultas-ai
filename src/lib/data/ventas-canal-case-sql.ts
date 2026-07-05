/**
 * Detección de canal (misma lógica que el dashboard de ventas).
 * Mantener sincronizado con reglas de negocio al añadir canales.
 */

/** Coincide solo con el canal Bosque Mágico (no cócteles "del bosque", etc.). */
export const BOSQUE_MAGICO_MATCH_SQL = `
  REGEXP_CONTAINS(UPPER(COALESCE(s.Cliente, '')), r'BOSQUE M')
  OR REGEXP_CONTAINS(UPPER(COALESCE(s.Producto, '')), r'BOSQUE M')
  OR REGEXP_CONTAINS(UPPER(COALESCE(s.Cliente, '')), r'CAJITA BOSQUE')
  OR REGEXP_CONTAINS(UPPER(COALESCE(s.Producto, '')), r'CAJITA BOSQUE')
`;

export const VENTAS_CANAL_CASE_SQL = `
  CASE
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%RAPPI%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%RAPPI%'
    THEN 'Rappi'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%PEDIDOSYA%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PEDIDOS YA%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PEDIDOSYA%'
    THEN 'PedidosYa'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%UBER%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%UBER%'
    THEN 'UberEats'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%FIDELIO%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%FIDELIO%'
    THEN 'Fidelio'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%PAGO LINK%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PAGOLINK%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PAGO LINK%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PAGOLINK%'
    THEN 'Pago Link'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%EVENTOS%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%EVENTOS%'
    THEN 'Eventos'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%CUPONATIC%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%CUPONATIC%'
    THEN 'Cuponatic'
    WHEN ${BOSQUE_MAGICO_MATCH_SQL}
    THEN 'Bosque Mágico'
    WHEN UPPER(COALESCE(s.Cliente, '')) LIKE '%LLEVAR%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%LLEVAR%'
      OR UPPER(COALESCE(s.Cliente, '')) LIKE '%PARA LLEVAR%'
      OR UPPER(COALESCE(s.Producto, '')) LIKE '%PARA LLEVAR%'
    THEN 'Llevar'
    ELSE 'Salón'
  END
`;
