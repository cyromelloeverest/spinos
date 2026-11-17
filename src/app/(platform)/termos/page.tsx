import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Termos de Uso — Spinos",
};

export default function TermosPage() {
  return (
    <LegalPageLayout title="Termos de Uso" updatedAt="17 de novembro de 2026">
      <section>
        <p>
          Estes Termos de Uso (&quot;Termos&quot;) regem o acesso e uso da plataforma Spinos — Inteligência
          Comercial, disponibilizada por <strong>Everest Consultoria e Marketing Ltda.</strong> (CNPJ
          20.055.110/0001-68), doravante <strong>&quot;Spinos&quot;</strong>. Ao criar uma conta ou utilizar a
          plataforma, você (&quot;Usuário&quot; ou &quot;Cliente&quot;) concorda integralmente com estes Termos e com
          a Política de Privacidade.
        </p>
      </section>

      <section>
        <h2>1. Descrição do serviço</h2>
        <p>
          A Spinos é uma plataforma de inteligência comercial B2B que identifica, prioriza e monitora oportunidades
          de negócio a partir do cruzamento de sinais públicos de mercado com o Perfil de Cliente Ideal (ICP)
          definido por cada cliente, oferecendo recomendações, scores de priorização e ferramentas de apoio à
          prospecção comercial. Além disso, a plataforma inclui CRM, site e páginas de captação, relatórios de
          origem e desempenho, geração de rascunhos de conteúdo com inteligência artificial e envio de campanhas de
          e-mail, conforme o plano contratado.
        </p>
        <p>A Spinos não é um data broker nem uma ferramenta de disparo em massa: campanhas de e-mail só chegam a contatos com consentimento ou relação contratual registrados.</p>
        <p>
          As informações apresentadas (scores, sugestões, sinais) são subsídios de apoio à decisão comercial,
          construídos a partir de dados públicos e modelos de inteligência artificial, e não constituem garantia de
          resultado comercial, tampouco aconselhamento jurídico, financeiro ou de investimento.
        </p>
      </section>

      <section>
        <h2>2. Cadastro e conta</h2>
        <p>
          O Usuário deve fornecer informações verdadeiras, completas e atualizadas no cadastro, e é responsável pela
          guarda de suas credenciais de acesso. É vedado compartilhar login/senha com terceiros fora dos limites de
          usuários contratados no plano.
        </p>
      </section>

      <section>
        <h2>3. Planos, preços e pagamento</h2>
        <ul>
          <li>
            A Spinos é oferecida em planos de assinatura mensal recorrente (Essencial, Crescimento e Aceleração),
            com limites de contas-alvo por mês, usuários e uso de conteúdo e e-mail conforme descrito na página de
            planos vigente. A franquia mensal de contas-alvo não se acumula para o mês seguinte.
          </li>
          <li>
            Na primeira assinatura é cobrada uma <strong>implantação única de R$ 1.500</strong>, salvo condição
            comercial diferente acordada por escrito.
          </li>
          <li>
            Cada assinatura tem <strong>fidelidade mínima de 6 (seis) meses</strong>. O cancelamento antes desse
            prazo não gera reembolso e obriga ao pagamento das mensalidades que faltarem para completar o período
            mínimo. Depois dos 6 meses o cancelamento pode ser feito a qualquer momento, sem multa, com efeitos ao
            final do ciclo vigente.
          </li>
          <li>
            Pagamentos são processados pela Stripe. A assinatura é recorrente e renovada automaticamente até
            cancelamento pelo próprio Usuário.
          </li>
          <li>
            O período de teste gratuito não exige cartão de crédito e não se converte automaticamente em assinatura
            paga: ao seu término o acesso fica limitado até que o Usuário contrate um plano.
          </li>
          <li>
            A verba de mídia (Google Ads, Meta Ads) é paga diretamente pelo Cliente às plataformas de anúncio. A
            gestão de anúncios e a produção de conteúdo para redes sociais fazem parte do plano Aceleração e podem
            ser contratadas à parte nos demais planos, com escopo e preço próprios.
          </li>
          <li>
            Preços podem ser reajustados mediante aviso prévio, aplicando-se a partir do próximo ciclo de cobrança.
            Condições de preço travado concedidas por escrito a clientes fundadores prevalecem pelo prazo acordado.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Propriedade intelectual</h2>
        <p>
          A plataforma Spinos — incluindo, mas não se limitando a, código-fonte, interface, identidade visual, marca,
          textos, estrutura de funcionalidades, metodologia de scoring e documentação — é de titularidade exclusiva
          da Everest Consultoria e Marketing Ltda., constituindo desenvolvimento próprio e original, protegido pela
          Lei nº 9.610/1998 (Direitos Autorais) e pela Lei nº 9.279/1996 (Propriedade Industrial), no que couber.
        </p>
        <p>É vedado ao Usuário, sem autorização prévia e por escrito:</p>
        <ul>
          <li>Copiar, reproduzir, modificar ou criar obras derivadas da plataforma;</li>
          <li>Realizar engenharia reversa, descompilação ou extração da lógica/algoritmos da plataforma;</li>
          <li>Utilizar a marca, nome ou identidade visual da Spinos fora do uso normal como cliente;</li>
          <li>Utilizar a plataforma para desenvolver produto concorrente.</li>
        </ul>
        <p>
          Dados inseridos pelo próprio Usuário (por exemplo, informações de ICP e anotações) permanecem de
          titularidade do Usuário/Cliente, sendo licenciados à Spinos apenas na medida necessária à prestação do
          serviço.
        </p>
      </section>

      <section>
        <h2>5. Uso de Inteligência Artificial — transparência</h2>
        <p>
          O Usuário reconhece que parte das funcionalidades (scores, resumos, sugestões, assistente de chat) é
          gerada com apoio de modelos de inteligência artificial de terceiros, podendo conter imprecisões ou
          desatualizações. Recomendações geradas por IA devem ser revisadas com julgamento humano antes de decisões
          comerciais relevantes. Textos gerados (posts, artigos, e-mails) são <strong>rascunhos</strong>: o Cliente
          responde pelo que decide publicar ou enviar e pela conformidade desse conteúdo com as normas do seu
          conselho profissional (por exemplo, as normas de publicidade da sua categoria).
        </p>
      </section>

      <section>
        <h2>6. Dados de terceiros, contatos do Cliente e fontes públicas</h2>
        <p>
          Os sinais e dados de empresas-alvo exibidos na plataforma são obtidos de fontes públicas. A Spinos não
          garante a veracidade, atualidade ou legalidade da informação de origem de terceiros, e o Usuário é
          responsável pelo uso que fizer dessas informações em suas próprias ações comerciais, inclusive quanto ao
          cumprimento da legislação aplicável em sua relação com os terceiros contatados.
        </p>
        <p>
          <strong>Contatos e leads do Cliente:</strong> quanto aos dados pessoais dos contatos e leads que o Cliente
          importa, cadastra ou recebe pelo site e pelo e-mail da Spinos, o Cliente é o controlador e a Spinos é
          operadora, tratando-os somente conforme as instruções do Cliente e para prestar o serviço, nos termos da
          Política de Privacidade. Ao aceitar estes Termos o Cliente aceita esse tratamento como aditivo de
          tratamento de dados. O Cliente declara ter base legal para os contatos que importa ou coleta e se
          compromete a enviar e-mail de campanha somente a quem consentiu ou é seu cliente.
        </p>
      </section>

      <section>
        <h2>7. Obrigações e vedações do Usuário</h2>
        <p>O Usuário compromete-se a não utilizar a plataforma para:</p>
        <ul>
          <li>Violar leis aplicáveis;</li>
          <li>Assediar, importunar ou praticar spam contra terceiros identificados via plataforma;</li>
          <li>Extrair dados em massa (scraping) da plataforma;</li>
          <li>Revender ou sublicenciar acesso à plataforma;</li>
          <li>Utilizar a Spinos de forma que prejudique sua disponibilidade ou segurança;</li>
          <li>Enviar e-mail a quem não consentiu ou não é seu cliente, ou publicar conteúdo ilícito ou enganoso.</li>
        </ul>
      </section>

      <section>
        <h2>8. Limitação de responsabilidade</h2>
        <p>
          Na máxima extensão permitida pela lei, a Spinos não se responsabiliza por decisões comerciais tomadas com
          base nas recomendações da plataforma, por indisponibilidades temporárias decorrentes de manutenção, falha
          de fornecedores terceiros ou casos fortuitos/força maior, tampouco por danos indiretos, lucros cessantes
          ou perda de negócios decorrentes do uso ou impossibilidade de uso da plataforma. A responsabilidade total
          da Spinos, quando aplicável, fica limitada ao valor pago pelo Usuário nos últimos 12 (doze) meses.
        </p>
      </section>

      <section>
        <h2>9. Rescisão e suspensão</h2>
        <p>
          A Spinos pode suspender ou encerrar o acesso de Usuários que violem estes Termos, mediante aviso quando
          possível. O envio de e-mails pode ser pausado, e um site pode ser retirado do ar, se houver indício de
          fraude, spam ou conteúdo ilícito, ou se as taxas de endereços inexistentes ou de reclamações de spam
          passarem do tolerado pelos provedores de e-mail. O Usuário pode encerrar sua conta a qualquer momento. Encerrada a relação, aplicam-se as regras
          de retenção e eliminação de dados da Política de Privacidade.
        </p>
      </section>

      <section>
        <h2>10. Confidencialidade</h2>
        <p>
          Ambas as partes comprometem-se a manter sigilo sobre informações não públicas trocadas em razão do uso da
          plataforma, incluindo dados comerciais do Cliente inseridos no sistema.
        </p>
      </section>

      <section>
        <h2>11. Alterações destes Termos</h2>
        <p>
          Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas com
          antecedência razoável. O uso continuado da plataforma após a alteração implica concordância com os novos
          termos.
        </p>
      </section>

      <section>
        <h2>12. Legislação aplicável e foro</h2>
        <p>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Jundiaí-SP para dirimir
          quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado
          que seja.
        </p>
      </section>

      <section>
        <h2>13. Disposições gerais</h2>
        <p>
          A tolerância quanto ao descumprimento de qualquer cláusula não implica renúncia ao direito de exigi-la
          posteriormente. Se qualquer disposição destes Termos for considerada inválida, as demais permanecem em
          pleno vigor. Dúvidas:{" "}
          <a href="mailto:contato@spinos.com.br" style={{ color: "var(--primary)" }}>
            contato@spinos.com.br
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
