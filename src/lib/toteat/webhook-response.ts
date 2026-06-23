import type { ToteatDashboardData } from "./dashboard-data";
import { getToteatSalesReportLabel, getToteatSourceNoteShort } from "./source-context";

export function buildToteatWebhookSummary(data: ToteatDashboardData) {
  return {
    source: getToteatSalesReportLabel(),
    source_note: getToteatSourceNoteShort(),
    restaurant: data.restaurant,
    start_date: data.start_date,
    end_date: data.end_date,
    applied_filters: data.applied_filters,
    total_sales: data.total_sales,
    total_sales_after_discounts: data.total_sales_after_discounts,
    total_taxes: data.total_taxes,
    total_net_sales: data.total_net_sales,
    total_paid: data.total_paid,
    total_discounts: data.total_discounts,
    total_gratuity: data.total_gratuity,
    orders_count: data.orders_count,
    payments_count: data.payments_count,
    clients_count: data.clients_count,
    average_ticket_gross: data.average_ticket_gross,
    average_ticket_net: data.average_ticket_net,
    average_ticket_per_client: data.average_ticket_per_client,
    business_split: data.business_split,
    top_waiters: data.top_waiters.slice(0, 10),
    payment_methods: data.payment_methods.slice(0, 12),
    top_products: data.top_products.slice(0, 15),
    charts: {
      por_turno: data.charts.por_turno,
      por_dia: data.charts.por_dia,
      por_hora: data.charts.por_hora.slice(0, 24),
    },
    cancellations: data.cancellations,
    fiscal_documents: data.fiscal_documents,
  };
}
