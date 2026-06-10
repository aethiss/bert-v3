const CRC32_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC32_TABLE[index] = crc >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeInlineStringCell(value: string): string {
  return `<c t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildSheetXml(headers: string[], rows: string[][]): string {
  const body = [headers, ...rows]
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row.map((value) => encodeInlineStringCell(value ?? '')).join('')}</row>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function buildWorkbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="1">
    <fill>
      <patternFill patternType="none"/>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class ZipWriter {
  private readonly chunks: number[] = [];

  private writeByte(value: number): void {
    this.chunks.push(value & 0xff);
  }

  private writeUint16(value: number): void {
    this.writeByte(value);
    this.writeByte(value >>> 8);
  }

  private writeUint32(value: number): void {
    this.writeByte(value);
    this.writeByte(value >>> 8);
    this.writeByte(value >>> 16);
    this.writeByte(value >>> 24);
  }

  private writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.writeByte(byte);
    }
  }

  addFile(name: string, content: string): void {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);
    const crc = crc32(dataBytes);
    const localHeaderOffset = this.chunks.length;

    this.writeUint32(0x04034b50);
    this.writeUint16(20);
    this.writeUint16(0x0800);
    this.writeUint16(0);
    this.writeUint16(0);
    this.writeUint16(0);
    this.writeUint32(crc);
    this.writeUint32(dataBytes.length);
    this.writeUint32(dataBytes.length);
    this.writeUint16(nameBytes.length);
    this.writeUint16(0);
    this.writeBytes(nameBytes);
    this.writeBytes(dataBytes);

    this.centralDirectoryEntries.push({
      nameBytes,
      crc,
      size: dataBytes.length,
      offset: localHeaderOffset
    });
  }

  private readonly centralDirectoryEntries: Array<{
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }> = [];

  toBuffer(): Buffer {
    const centralDirectoryOffset = this.chunks.length;

    for (const entry of this.centralDirectoryEntries) {
      this.writeUint32(0x02014b50);
      this.writeUint16(20);
      this.writeUint16(20);
      this.writeUint16(0x0800);
      this.writeUint16(0);
      this.writeUint16(0);
      this.writeUint16(0);
      this.writeUint32(entry.crc);
      this.writeUint32(entry.size);
      this.writeUint32(entry.size);
      this.writeUint16(entry.nameBytes.length);
      this.writeUint16(0);
      this.writeUint16(0);
      this.writeUint16(0);
      this.writeUint16(0);
      this.writeUint32(0);
      this.writeUint32(entry.offset);
      this.writeBytes(entry.nameBytes);
    }

    const centralDirectorySize = this.chunks.length - centralDirectoryOffset;
    const entryCount = this.centralDirectoryEntries.length;

    this.writeUint32(0x06054b50);
    this.writeUint16(0);
    this.writeUint16(0);
    this.writeUint16(entryCount);
    this.writeUint16(entryCount);
    this.writeUint32(centralDirectorySize);
    this.writeUint32(centralDirectoryOffset);
    this.writeUint16(0);

    return Buffer.from(this.chunks);
  }
}

export function buildXlsxBuffer(sheetName: string, headers: string[], rows: string[][]): Buffer {
  const zip = new ZipWriter();
  zip.addFile('[Content_Types].xml', buildContentTypesXml());
  zip.addFile('_rels/.rels', buildRootRelsXml());
  zip.addFile('xl/workbook.xml', buildWorkbookXml(sheetName));
  zip.addFile('xl/_rels/workbook.xml.rels', buildWorkbookRelsXml());
  zip.addFile('xl/styles.xml', buildStylesXml());
  zip.addFile('xl/worksheets/sheet1.xml', buildSheetXml(headers, rows));
  return zip.toBuffer();
}
