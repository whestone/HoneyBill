import { PDFDocument, PDFName, PDFString, PDFRawStream, PDFDict, PDFArray, asPDFName } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../../config.js";

/**
 * Package a plain PDF with a ZUGFeRD 2.3 XML into a PDF/A-3b compliant file.
 *
 * This performs:
 * 1. Load the base PDF bytes
 * 2. Embed factur-x.xml as an EmbeddedFile with AFRelationship=Alternative
 * 3. Add AF array to document catalog
 * 4. Inject XMP metadata declaring PDF/A-3b conformance + ZUGFeRD profile
 * 5. Embed sRGB ICC OutputIntent (if ICC file available)
 * 6. Return the modified PDF bytes
 */
export async function packageZugferdPdf(
  pdfBytes: Uint8Array,
  xmlString: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  const xmlBytes = new TextEncoder().encode(xmlString);
  const xmlHash = crypto.createHash("sha256").update(xmlBytes).digest("hex");
  const now = new Date().toISOString();

  // ─── Embed factur-x.xml ────────────────────────────────────────────────────

  const embeddedFileStream = pdfDoc.context.stream(xmlBytes, {
    Type: "EmbeddedFile",
    Subtype: "text/xml",
    Params: PDFDict.withContext(pdfDoc.context),
  });

  // Set params dict on the stream
  const paramsDict = pdfDoc.context.obj({
    Size: xmlBytes.length,
    ModDate: PDFString.of(`D:${now.replace(/[-:T]/g, "").slice(0, 14)}Z`),
    CheckSum: PDFString.of(xmlHash.slice(0, 32)),
  });
  (embeddedFileStream.dict as PDFDict).set(PDFName.of("Params"), paramsDict);

  const embeddedFileRef = pdfDoc.context.register(embeddedFileStream);

  // Build filespec dict
  const filespecDict = pdfDoc.context.obj({
    Type: "Filespec",
    F: PDFString.of("factur-x.xml"),
    UF: PDFString.of("factur-x.xml"),
    EF: PDFDict.withContext(pdfDoc.context),
    Desc: PDFString.of("ZUGFeRD/Factur-X Invoice"),
    AFRelationship: PDFName.of("Alternative"),
  });
  (filespecDict as PDFDict).set(
    PDFName.of("EF"),
    pdfDoc.context.obj({ F: embeddedFileRef, UF: embeddedFileRef })
  );

  const filespecRef = pdfDoc.context.register(filespecDict);

  // Add to catalog AF array
  const catalog = pdfDoc.catalog;
  const afArray = PDFArray.withContext(pdfDoc.context);
  afArray.push(filespecRef);
  catalog.set(PDFName.of("AF"), afArray);

  // Add to EmbeddedFiles name tree
  const namesDict = pdfDoc.context.obj({
    EmbeddedFiles: pdfDoc.context.obj({
      Names: pdfDoc.context.obj(["factur-x.xml", filespecRef]),
    }),
  });
  catalog.set(PDFName.of("Names"), namesDict);

  // ─── XMP Metadata ─────────────────────────────────────────────────────────

  const xmpXml = buildXmpMetadata(now);
  const xmpStream = pdfDoc.context.stream(new TextEncoder().encode(xmpXml), {
    Type: "Metadata",
    Subtype: "XML",
  });
  const xmpRef = pdfDoc.context.register(xmpStream);
  catalog.set(PDFName.of("Metadata"), xmpRef);

  // ─── Output Intent (PDF/A) ─────────────────────────────────────────────────

  const iccPath = config.iccPath;
  if (fs.existsSync(iccPath)) {
    const iccBytes = fs.readFileSync(iccPath);
    const iccStream = pdfDoc.context.stream(new Uint8Array(iccBytes), {
      N: 3, // sRGB is 3-component
      Alternate: "DeviceRGB",
    });
    const iccRef = pdfDoc.context.register(iccStream);

    const outputIntentDict = pdfDoc.context.obj({
      Type: "OutputIntent",
      S: PDFName.of("GTS_PDFA1"),
      OutputConditionIdentifier: PDFString.of("sRGB"),
      DestOutputProfile: iccRef,
    });
    const outputIntentsArray = PDFArray.withContext(pdfDoc.context);
    outputIntentsArray.push(pdfDoc.context.register(outputIntentDict));
    catalog.set(PDFName.of("OutputIntents"), outputIntentsArray);
  }

  // ─── MarkInfo (required for PDF/A) ────────────────────────────────────────

  catalog.set(
    PDFName.of("MarkInfo"),
    pdfDoc.context.obj({ Marked: true })
  );

  return pdfDoc.save();
}

function buildXmpMetadata(isoDate: string): string {
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <!-- PDF/A-3b conformance -->
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <!-- ZUGFeRD / Factur-X metadata -->
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}
