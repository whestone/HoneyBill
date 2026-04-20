import { describe, expect, it } from "vitest";
import { generateXRechnungXml } from "./xrechnung.service.js";

// Minimal-Mock für die vom Generator verwendeten Felder.
const customer = {
  id: 1,
  customerNumber: "K001",
  companyName: "Bio-Supermarkt Grüne Erde",
  firstName: null,
  lastName: null,
  email: "buyer@example.com",
  phone: null,
  billStreet: "Prenzlauer Allee 47",
  billZip: "10405",
  billCity: "Berlin",
  billCountry: "DE",
  vatId: "DE987654321",
  leitwegId: null,
  paymentDays: null,
} as any;

const company = {
  id: 1,
  name: "Imkerei Sonnentracht",
  legalForm: null,
  street: "Bienenweg 14",
  zip: "83700",
  city: "Rosenheim",
  country: "DE",
  vatId: "DE301234567",
  taxNumber: null,
  bankIban: "DE89370400440532013000",
  bankBic: "COBADEFFXXX",
  bankName: "Commerzbank",
  email: "info@imkerei-sonnentracht.de",
  phone: "+49 8031 443322",
  website: null,
  logoPath: null,
  defaultCurrency: "EUR",
  defaultPaymentDays: 14,
  pdfSettings: null,
  emailSettings: null,
} as any;

const baseDoc = {
  id: 10,
  documentType: "INVOICE",
  documentNumber: "RE-2026-00001",
  customerId: 1,
  issueDate: "2026-04-16",
  dueDate: "2026-05-16",
  deliveryDate: "2026-04-16",
  currency: "EUR",
  subtotalNet: "100.00",
  totalTax: "19.00",
  totalGross: "119.00",
  paymentDays: 30,
  paymentTermsText: "Zahlungsziel: 30 Tage",
  leitwegId: null,
  lineItems: [
    {
      lineType: "ITEM",
      description: "Waldhonig 500g",
      quantity: "10",
      unit: "Stk",
      unitPrice: "10.00",
      discountPct: "0",
      discountType: "pct",
      lineNet: "100.00",
      taxRatePct: "19.00",
    },
  ],
  taxLines: [
    { taxCategory: "S", taxRatePct: "19.00", taxableAmount: "100.00", taxAmount: "19.00" },
  ],
} as any;

describe("generateXRechnungXml", () => {
  it("enthält BusinessProcess und XRechnung-Guideline", () => {
    const xml = generateXRechnungXml(baseDoc, customer, company);
    expect(xml).toContain("BusinessProcessSpecifiedDocumentContextParameter");
    expect(xml).toContain("urn:fdc:peppol.eu:2017:poacc:billing:01:1.0");
    expect(xml).toContain("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0");
  });

  it("enthält DefinedTradeContact für Seller (BR-DE-2)", () => {
    const xml = generateXRechnungXml(baseDoc, customer, company);
    expect(xml).toContain("DefinedTradeContact");
    expect(xml).toContain("+49 8031 443322");
    expect(xml).toContain("info@imkerei-sonnentracht.de");
  });

  it("rendert PostalTradeAddress vor SpecifiedTaxRegistration in SellerTradeParty", () => {
    const xml = generateXRechnungXml(baseDoc, customer, company);
    const sellerBlock = xml.split("SellerTradeParty")[1] ?? "";
    expect(sellerBlock.indexOf("PostalTradeAddress")).toBeLessThan(
      sellerBlock.indexOf("SpecifiedTaxRegistration"),
    );
  });

  it("enthält BuyerReference mit Fallback auf Rechnungsnummer", () => {
    const xml = generateXRechnungXml(baseDoc, customer, company);
    expect(xml).toContain("<ram:BuyerReference>RE-2026-00001</ram:BuyerReference>");
  });

  it("aggregiert Tax-Lines mit gleichem normalisiertem Rate+Category in eine Zeile", () => {
    const doc = {
      ...baseDoc,
      taxLines: [
        { taxCategory: "S", taxRatePct: "9.5", taxableAmount: "14.56", taxAmount: "1.38" },
        { taxCategory: "S", taxRatePct: "9.50", taxableAmount: "12.40", taxAmount: "1.18" },
      ],
    };
    const xml = generateXRechnungXml(doc, customer, company);
    // Nur EINE ApplicableTradeTax mit Rate 9.50 im Header-Settlement (zzgl. der Line-Item-ApplicableTradeTax)
    const settlementBlock = xml.split("ApplicableHeaderTradeSettlement")[1] ?? "";
    const matches = settlementBlock.match(/RateApplicablePercent>9\.50</g) ?? [];
    expect(matches.length).toBe(1);
    // Basisbetrag ist aufsummiert: 14.56 + 12.40 = 26.96
    expect(settlementBlock).toContain("<ram:BasisAmount>26.96</ram:BasisAmount>");
  });

  it("mappt ungültige Tax-Categories (z.B. R) auf UNCL-5305 'S'", () => {
    const doc = {
      ...baseDoc,
      taxLines: [
        { taxCategory: "R", taxRatePct: "7.00", taxableAmount: "4.20", taxAmount: "0.29" },
      ],
    };
    const xml = generateXRechnungXml(doc, customer, company);
    const settlementBlock = xml.split("ApplicableHeaderTradeSettlement")[1] ?? "";
    expect(settlementBlock).not.toContain("<ram:CategoryCode>R</ram:CategoryCode>");
    expect(settlementBlock).toContain("<ram:CategoryCode>S</ram:CategoryCode>");
  });

  it("escaped XML-Sonderzeichen im Produktnamen", () => {
    const doc = {
      ...baseDoc,
      lineItems: [
        { ...baseDoc.lineItems[0], description: "Honig <Bio> & \"Premium\"" },
      ],
    };
    const xml = generateXRechnungXml(doc, customer, company);
    expect(xml).toContain("&lt;Bio&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("<Bio>");
  });

  it("lässt leere Buyer-Adressfelder (Zip/Street/City) ohne leere XML-Elemente weg", () => {
    const bareCustomer = { ...customer, billZip: null, billStreet: null, billCity: null };
    const xml = generateXRechnungXml(baseDoc, bareCustomer, company);
    const buyerBlock = xml.split("BuyerTradeParty")[1] ?? "";
    expect(buyerBlock).not.toContain("<ram:PostcodeCode></ram:PostcodeCode>");
    expect(buyerBlock).not.toContain("<ram:LineOne></ram:LineOne>");
    expect(buyerBlock).not.toContain("<ram:CityName></ram:CityName>");
  });
});
