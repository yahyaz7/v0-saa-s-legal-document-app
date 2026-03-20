import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

/**
 * Universal DOCX generator using docxtemplater.
 * Takes a DOCX file (as ArrayBuffer/Buffer) and a data object,
 * and returns the populated DOCX as a Blob/Buffer.
 */
export async function generateFromTemplate(
  templateBuffer: ArrayBuffer | Buffer,
  data: Record<string, any>
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer);
  
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Render the document (replace placeholders {key} with data[key])
  doc.render(data);

  // Get the resulting zip as a node buffer
  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf;
}
