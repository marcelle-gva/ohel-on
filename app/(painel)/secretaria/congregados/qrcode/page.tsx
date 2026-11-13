"use client";

import { PublicQrCodePage } from "@/components/qrcode/PublicQrCodePage";

export default function CongregadosQrCodePage() {
  return (
    <PublicQrCodePage
      tipo="congregado"
      voltarPara="/secretaria/congregados"
      titulo="QR Code do congregado"
      descricao="Compartilhe o pré-cadastro público da sua igreja."
      chamada="Aponte a câmera do celular para que a pessoa envie seus dados básicos à secretaria, sem criar acesso administrativo."
    />
  );
}
