import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeDisplay({ value, size = 200 }) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-center p-4 bg-white rounded-lg">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        includeMargin={true}
      />
    </div>
  );
}







