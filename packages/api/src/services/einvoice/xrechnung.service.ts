import Mustache from "mustache";
import type { Document, Customer, CompanySettings } from "@honeybill/shared";

/** Build XRechnung 3.0 XML (CII / UN/CEFACT) from a finalized document. */
export function generateXRechnungXml(
  doc: Document & { lineItems: NonNullable<Document["lineItems"]>; taxLines: NonNullable<Document["taxLines"]> },
  customer: Customer,
  company: CompanySettings
): string {
  const view = buildCiiView(doc, customer, company, "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0");
  return Mustache.render(CII_TEMPLATE, view);
}

/** Build ZUGFeRD 2.3 EXTENDED XML (same CII format, different GuidelineID). */
export function generateZugferdXml(
  doc: Document & { lineItems: NonNullable<Document["lineItems"]>; taxLines: NonNullable<Document["taxLines"]> },
  customer: Customer,
  company: CompanySettings
): string {
  const view = buildCiiView(doc, customer, company, "urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended");
  return Mustache.render(CII_TEMPLATE, view);
}

/** UNCL 5305 tax category codes (allowed values). */
const UNCL_5305_CATEGORIES = new Set(["S", "Z", "E", "AE", "K", "G", "O", "L", "M"]);

/** Map internal tax category to a valid UNCL 5305 code.
 *  German reduced rate (7%) is still category "S" (no separate "R" in UNCL 5305). */
function mapCategoryCode(code: string | null | undefined): string {
  const c = (code ?? "").toUpperCase().trim();
  if (UNCL_5305_CATEGORIES.has(c)) return c;
  return "S"; // fallback for legacy "R" / reduced / unset
}

/** Normalize VAT rate to 2 decimals so "9.5" and "9.50" compare equal. */
function normalizeRate(rate: string | number | null | undefined): string {
  const n = typeof rate === "number" ? rate : parseFloat(String(rate ?? "0"));
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

function toAmount(amount: string | number | null | undefined): number {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount ?? "0"));
  return Number.isNaN(n) ? 0 : n;
}

function buildCiiView(
  doc: Document & { lineItems: NonNullable<Document["lineItems"]>; taxLines: NonNullable<Document["taxLines"]> },
  customer: Customer,
  company: CompanySettings,
  guidelineId: string
) {
  const issueDate = (doc.issueDate ?? "").replace(/-/g, "");
  const dueDate = (doc.dueDate ?? doc.issueDate ?? "").replace(/-/g, "");
  const deliveryDate = (doc.deliveryDate ?? doc.issueDate ?? "").replace(/-/g, "");

  const lines = doc.lineItems
    .filter((li) => li.lineType === "ITEM")
    .map((li, idx) => ({
      lineId: idx + 1,
      description: escapeXml(li.description),
      quantity: li.quantity,
      unit: mapUnit(li.unit),
      unitPrice: li.unitPrice,
      lineNet: li.lineNet,
      taxPercent: normalizeRate(li.taxRatePct),
      taxCategoryCode: "S",
    }));

  // Aggregate tax lines by (category, rate) to fulfil BR-S-08.
  const taxMap = new Map<string, { taxCategoryCode: string; taxPercent: string; taxableAmount: number; taxAmount: number }>();
  for (const tl of doc.taxLines) {
    const cat = mapCategoryCode(tl.taxCategory);
    const rate = normalizeRate(tl.taxRatePct);
    const key = `${cat}|${rate}`;
    const existing = taxMap.get(key);
    if (existing) {
      existing.taxableAmount += toAmount(tl.taxableAmount);
      existing.taxAmount += toAmount(tl.taxAmount);
    } else {
      taxMap.set(key, {
        taxCategoryCode: cat,
        taxPercent: rate,
        taxableAmount: toAmount(tl.taxableAmount),
        taxAmount: toAmount(tl.taxAmount),
      });
    }
  }
  const taxLines = [...taxMap.values()].map((t) => ({
    taxCategoryCode: t.taxCategoryCode,
    taxPercent: t.taxPercent,
    taxableAmount: t.taxableAmount.toFixed(2),
    taxAmount: t.taxAmount.toFixed(2),
  }));

  const sellerContactName = escapeXml(company.name ?? "");
  const sellerPhone = escapeXml(company.phone ?? "");
  const sellerEmail = escapeXml(company.email ?? "");

  const buyerEmail = escapeXml(customer.email ?? "");

  return {
    // Default BusinessProcess for XRechnung (BT-23)
    businessProcess: "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    guidelineId,
    invoiceNumber: escapeXml(doc.documentNumber ?? ""),
    issueDate,
    dueDate,
    deliveryDate,
    currency: doc.currency,
    // Seller (company)
    sellerName: escapeXml(company.name),
    sellerStreet: escapeXml(company.street ?? ""),
    sellerCity: escapeXml(company.city ?? ""),
    sellerZip: escapeXml(company.zip ?? ""),
    sellerCountry: company.country,
    sellerVatId: escapeXml(company.vatId ?? ""),
    sellerTaxNumber: escapeXml(company.taxNumber ?? ""),
    sellerEmail,
    sellerPhone,
    sellerContactName,
    sellerIban: escapeXml(company.bankIban ?? ""),
    sellerBic: escapeXml(company.bankBic ?? ""),
    sellerBankName: escapeXml(company.bankName ?? ""),
    // Buyer (customer)
    buyerName: escapeXml(customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()),
    buyerStreet: escapeXml(customer.billStreet ?? ""),
    buyerCity: escapeXml(customer.billCity ?? ""),
    buyerZip: escapeXml(customer.billZip ?? ""),
    buyerCountry: customer.billCountry,
    buyerVatId: escapeXml(customer.vatId ?? ""),
    buyerEmail,
    // BT-10 (BuyerReference) ist in XRechnung Pflicht — Fallback auf Rechnungsnummer,
    // wenn keine Leitweg-ID / Bestellreferenz gepflegt ist.
    buyerLeitwegId: escapeXml(
      doc.leitwegId ?? customer.leitwegId ?? doc.documentNumber ?? "N/A"
    ),
    // Totals
    subtotalNet: doc.subtotalNet,
    totalTax: doc.totalTax,
    totalGross: doc.totalGross,
    // Tax lines (aggregated + normalized)
    taxLines,
    // Line items
    lines,
    paymentTermsText: escapeXml(doc.paymentTermsText ?? `Zahlungsziel: ${doc.paymentDays ?? 14} Tage`),
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function mapUnit(unit: string): string {
  const map: Record<string, string> = {
    Stk: "C62",
    Std: "HUR",
    kg: "KGM",
    m: "MTR",
    km: "KMT",
    l: "LTR",
    Psch: "LS",
  };
  return map[unit] ?? "C62";
}

// Minimal CII XML template (Mustache)
const CII_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>{{{businessProcess}}}</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>{{{guidelineId}}}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{{invoiceNumber}}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">{{issueDate}}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <!-- Line Items -->
    {{#lines}}
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>{{lineId}}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>{{description}}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>{{unitPrice}}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="{{unit}}">{{quantity}}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>{{taxCategoryCode}}</ram:CategoryCode>
          <ram:RateApplicablePercent>{{taxPercent}}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>{{lineNet}}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    {{/lines}}
    <!-- Header Trade Agreement -->
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>{{buyerLeitwegId}}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>{{sellerName}}</ram:Name>
        <ram:DefinedTradeContact>
          <ram:PersonName>{{sellerContactName}}</ram:PersonName>
          {{#sellerPhone}}
          <ram:TelephoneUniversalCommunication>
            <ram:CompleteNumber>{{sellerPhone}}</ram:CompleteNumber>
          </ram:TelephoneUniversalCommunication>
          {{/sellerPhone}}
          {{#sellerEmail}}
          <ram:EmailURIUniversalCommunication>
            <ram:URIID schemeID="SMTP">{{sellerEmail}}</ram:URIID>
          </ram:EmailURIUniversalCommunication>
          {{/sellerEmail}}
        </ram:DefinedTradeContact>
        <ram:PostalTradeAddress>
          {{#sellerZip}}<ram:PostcodeCode>{{sellerZip}}</ram:PostcodeCode>{{/sellerZip}}
          {{#sellerStreet}}<ram:LineOne>{{sellerStreet}}</ram:LineOne>{{/sellerStreet}}
          {{#sellerCity}}<ram:CityName>{{sellerCity}}</ram:CityName>{{/sellerCity}}
          <ram:CountryID>{{sellerCountry}}</ram:CountryID>
        </ram:PostalTradeAddress>
        {{#sellerEmail}}
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">{{sellerEmail}}</ram:URIID>
        </ram:URIUniversalCommunication>
        {{/sellerEmail}}
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">{{sellerVatId}}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>{{buyerName}}</ram:Name>
        <ram:PostalTradeAddress>
          {{#buyerZip}}<ram:PostcodeCode>{{buyerZip}}</ram:PostcodeCode>{{/buyerZip}}
          {{#buyerStreet}}<ram:LineOne>{{buyerStreet}}</ram:LineOne>{{/buyerStreet}}
          {{#buyerCity}}<ram:CityName>{{buyerCity}}</ram:CityName>{{/buyerCity}}
          <ram:CountryID>{{buyerCountry}}</ram:CountryID>
        </ram:PostalTradeAddress>
        {{#buyerEmail}}
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">{{buyerEmail}}</ram:URIID>
        </ram:URIUniversalCommunication>
        {{/buyerEmail}}
        {{#buyerVatId}}
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">{{buyerVatId}}</ram:ID>
        </ram:SpecifiedTaxRegistration>
        {{/buyerVatId}}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <!-- Delivery -->
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">{{deliveryDate}}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <!-- Settlement -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>{{currency}}</ram:InvoiceCurrencyCode>
      {{#sellerIban}}
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>{{sellerIban}}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
        {{#sellerBic}}
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>{{sellerBic}}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
        {{/sellerBic}}
      </ram:SpecifiedTradeSettlementPaymentMeans>
      {{/sellerIban}}
      <!-- Tax subtotals -->
      {{#taxLines}}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>{{taxAmount}}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>{{taxableAmount}}</ram:BasisAmount>
        <ram:CategoryCode>{{taxCategoryCode}}</ram:CategoryCode>
        <ram:RateApplicablePercent>{{taxPercent}}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      {{/taxLines}}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>{{paymentTermsText}}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">{{dueDate}}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{{subtotalNet}}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{{subtotalNet}}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="{{currency}}">{{totalTax}}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{{totalGross}}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{{totalGross}}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
