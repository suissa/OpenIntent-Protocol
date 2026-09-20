# OpenIntent-Protocol



À medida que ecossistemas de agentes se tornam mais distribuídos, um dos principais desafios deixa de ser a implementação da lógica de negócio e passa a ser a interoperabilidade entre agentes desenvolvidos por diferentes organizações, linguagens e infraestruturas.

O **OpenIntent Protocol (OIP)** propõe uma abordagem declarativa onde uma intenção é tratada como um contrato formal de execução, descrevendo não apenas a capacidade desejada, mas também como essa interação deve ocorrer.

O objetivo do protocolo é eliminar a necessidade de que agentes conheçam detalhes de comunicação, permitindo que implementações diferentes sejam interoperáveis a partir de uma especificação comum.

> **Observação:** O OpenIntent Protocol encontra-se atualmente em desenvolvimento como parte da arquitetura H2A2H (v0.3). Sua especificação ainda está evoluindo e poderá sofrer alterações até a publicação da versão 1.0.

---

# O problema atual

Hoje, quando dois serviços ou agentes precisam conversar, normalmente é necessário definir:

* qual protocolo será utilizado;
* como autenticar;
* como serializar mensagens;
* como tratar erros;
* como descobrir o destino;
* como realizar streaming ou eventos.

Isso faz com que a lógica da aplicação fique fortemente acoplada à infraestrutura.

Por exemplo:

```text
Agent
   ↓
gRPC Client
   ↓
mTLS
   ↓
ProtoBuf
   ↓
Load Balancer
   ↓
Servidor
```

Se a comunicação mudar para NATS ou QUIC, normalmente o agente também precisa ser modificado.

O OpenIntent Protocol busca eliminar esse acoplamento.

---

# Filosofia do OpenIntent Protocol

O protocolo parte de um princípio simples:

> **Um agente deve declarar o que deseja realizar, e não como deve se comunicar.**

A infraestrutura já conhece o contrato da intenção.

O agente apenas produz ou consome intenções.

---

# Arquitetura

O protocolo é dividido em quatro partes principais.

## 1. Intent

Define a operação semântica.

Exemplo:

* Validar pagamento
* Consultar estoque
* Emitir nota fiscal
* Reservar hotel
* Aprovar documento

A intenção representa o objetivo.

---

## 2. Capability

Define qual capacidade é necessária para executar aquela intenção.

Exemplo:

```text
PaymentValidation
```

ou

```text
InventoryReservation
```

Uma intenção pode possuir uma ou mais capacidades obrigatórias.

---

## 3. Channel

Define formalmente como aquela intenção deve trafegar.

O agente não escolhe.

O protocolo define.

---

## 4. Contract

Descreve:

* entradas;
* saídas;
* versão;
* compatibilidade;
* políticas;
* segurança.

---

# Estrutura conceitual do arquivo

Uma possível estrutura do OpenIntent poderia ser:

```yaml
version: 1

intent:
  id: payment.validate

  description: Validate a payment transaction

capability:

  name: PaymentValidation

channel:

  communication:

    pattern: request_response

    protocol: grpc

  security:

    authentication:
      - mtls

    authorization:
      - capability_token

input:

  transaction_id:

    type: uuid

output:

  status:

    type: PaymentStatus

errors:

  - PaymentNotFound
  - Unauthorized
```

Todo o comportamento esperado está descrito no próprio contrato.

---

# Padrões de comunicação

O protocolo suporta diferentes modelos de comunicação.

## Request / Response

Utilizado quando existe resposta imediata.

Exemplos:

* autenticação;
* consulta;
* validação;
* cálculo.

Protocolos recomendados:

* gRPC
* HTTP/3
* QUIC

---

## Streaming

Quando múltiplas respostas são esperadas.

Exemplos:

* geração de texto;
* vídeo;
* áudio;
* monitoramento.

Protocolos:

* WebTransport
* QUIC Streams
* WebSocket
* gRPC Streaming

---

## Event

Comunicação baseada em eventos.

Exemplos:

* pedido criado;
* pagamento aprovado;
* usuário cadastrado.

Protocolos:

* NATS
* Kafka
* MQTT

---

## Publish / Subscribe

Quando diversos agentes devem receber uma mesma informação.

Exemplo:

```text
OrderCreated

↓

BillingAgent

InventoryAgent

AnalyticsAgent

NotificationAgent
```

Protocolos:

* NATS
* Kafka
* MQTT

---

## Fire-and-Forget

Quando não existe necessidade de resposta.

Exemplos:

* auditoria;
* logs;
* métricas;
* telemetria.

Protocolos:

* UDP seguro
* QUIC Datagram
* NATS

---

# Definição do canal

No OpenIntent o canal também faz parte do contrato.

Exemplo:

```yaml
channel:

  pattern: event

  transport:

    protocol: nats

  qos:

    delivery: at_least_once

  persistence:

    enabled: true
```

Outro exemplo:

```yaml
channel:

  pattern: streaming

  transport:

    protocol: webtransport

  compression:

    enabled: true
```

O agente não implementa manualmente nenhum desses protocolos.

---

# Papel do Agent SDK

O Agent SDK é responsável por interpretar o OpenIntent Protocol.

A partir da definição declarativa ele gera automaticamente:

* clientes;
* serializadores;
* autenticação;
* conexões;
* handlers;
* validação.

O agente continua enxergando apenas uma API simples:

```text
execute(intent)
```

ou

```text
publish(intent)
```

Toda a infraestrutura é materializada pelo SDK.

---

# OpenIntent + OpenEntityChannels

O OpenIntent Protocol trabalha em conjunto com o OpenEntityChannels.

Enquanto o OpenIntent descreve a intenção semântica, o OpenEntityChannels descreve as características do canal utilizado.

Essa separação permite evoluir transportes sem alterar o significado da intenção.

---

# Benefícios

## Interoperabilidade

Agentes escritos em linguagens diferentes conseguem compartilhar contratos comuns.

---

## Padronização

Todas as intenções seguem o mesmo formato.

---

## Geração automática

Grande parte do código de infraestrutura pode ser gerada.

---

## Auditabilidade

O comportamento esperado fica registrado no contrato.

---

## Evolução

Novos protocolos podem ser suportados pelo SDK sem exigir alterações na lógica dos agentes, desde que continuem compatíveis com os padrões declarados pelo OpenIntent Protocol e pelo OpenEntityChannels.

---

# Fluxo de execução

```text
Humano

↓

Agent

↓

OpenIntent Protocol

↓

Agent SDK

↓

OpenEntityChannel

↓

Transporte definido no contrato

↓

Agent Executor

↓

Resultado

↓

Humano
```

Observe que **o transporte não é escolhido em tempo de execução**. Ele já faz parte da especificação do contrato da intenção, garantindo comportamento determinístico entre diferentes implementações do protocolo.

---

# Próximos passos

A especificação atual representa a base do OpenIntent Protocol, mas diversos elementos ainda estão em desenvolvimento para a versão 1.0, incluindo:

* versionamento e negociação de compatibilidade;
* composição e encadeamento de intenções;
* definição formal de tipos e schemas;
* descoberta distribuída de capacidades;
* assinatura criptográfica das intenções;
* execução assíncrona e de longa duração;
* extensões para auditoria e rastreabilidade;
* integração formal com os protocolos **OpenDelegation Protocol** e **Proof-of-Human-Return**, compondo o ecossistema H2A2H.

O objetivo é que o OpenIntent Protocol se torne um contrato aberto para comunicação entre agentes, independente de linguagem, framework ou infraestrutura, permitindo que diferentes implementações interoperem por meio de uma especificação comum.

