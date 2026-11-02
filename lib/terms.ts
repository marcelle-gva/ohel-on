export type TermoCredencialId =
  | "entrega_credencial"
  | "doacao_bem_movel"
  | "lgpd"
  | "imagem_adulto"
  | "imagem_menor";

export interface TermoCredencial {
  id: TermoCredencialId;
  titulo: string;
  versao: string;
  obrigatorio: boolean;
  texto: string;
}

export const TERMOS_CREDENCIAL: TermoCredencial[] = [
  {
    id: "entrega_credencial",
    titulo: "Entrega e uso da credencial",
    versao: "1.0",
    obrigatorio: true,
    texto: "Declaro que recebi a credencial emitida em meu nome pela igreja. Comprometo-me a não emprestar, vender, copiar ou adulterar o documento e comunicarei perda, furto, dano ou alteração dos meus dados à secretaria. Estou ciente de que a credencial é instrumento de identificação e controle administrativo, pode ser bloqueada ou substituída por motivo de segurança e não cria contrato de trabalho, participação societária ou garantia de acesso irrestrito.",
  },
  {
    id: "doacao_bem_movel",
    titulo: "Doação de bem móvel",
    versao: "1.0",
    obrigatorio: false,
    texto: "Declaro que, por livre liberalidade, transfiro gratuitamente à igreja o bem descrito no registro de entrega, que sou titular ou tenho poderes para doá-lo e que informei eventuais defeitos ou direitos de terceiros. A igreja aceita a doação para suas finalidades institucionais. Este aceite comprova a entrega e a aceitação, sem afastar hipóteses legais de invalidade ou revogação; condições, encargos, descrição, valor e estado do bem devem constar no registro próprio.",
  },
  {
    id: "lgpd",
    titulo: "Dados pessoais e privacidade",
    versao: "1.0",
    obrigatorio: true,
    texto: "Declaro que fui informado sobre a coleta e o uso dos meus dados para cadastro, identificação, comunicação, emissão de credencial, organização de atividades e cumprimento de obrigações legais. Sei que posso solicitar confirmação, acesso, correção e demais direitos previstos na LGPD pelo contato informado pela igreja. Quando o consentimento for a base legal, ele será específico e poderá ser revogado por meio gratuito e facilitado.",
  },
  {
    id: "imagem_adulto",
    titulo: "Uso de imagem e voz — maior de idade",
    versao: "1.0",
    obrigatorio: false,
    texto: "Autorizo, de forma gratuita e não exclusiva, o uso da minha imagem e voz em registros das atividades institucionais da igreja, exclusivamente em seus canais oficiais e para divulgação das atividades religiosas e comunitárias. Não autorizo uso comercial por terceiros ou edição que altere o sentido da participação. A autorização pode ser retirada para novos usos pelo contato informado pela igreja, observados os efeitos dos materiais já produzidos e as hipóteses legais de conservação.",
  },
  {
    id: "imagem_menor",
    titulo: "Criança ou adolescente — autorização do responsável",
    versao: "1.0",
    obrigatorio: false,
    texto: "Na qualidade de responsável legal, autorizo a participação e, quando selecionado, o uso de imagem e voz da criança ou adolescente identificado no cadastro, exclusivamente para as finalidades e canais informados pela igreja. Declaro que fui informado sobre dados coletados, finalidade, prazo, canais e formas de exercício de direitos. A igreja deverá atuar no melhor interesse do menor, coletar somente o necessário e não divulgar rotina, localização em tempo real ou dados sensíveis sem necessidade e autorização adequada.",
  },
];
