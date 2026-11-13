"use client";

import { PublicQrCodePage } from "@/components/qrcode/PublicQrCodePage";

export default function VisitantesQrCodePage() {
  return (
    <PublicQrCodePage
      tipo="visitante"
      voltarPara="/secretaria/visitantes"
      titulo="QR Code do visitante"
      descricao="Compartilhe o cadastro público de visitantes."
      chamada="Aponte a câmera do celular para o visitante preencher seus dados no formulário oficial da igreja."
    />
  );
}
