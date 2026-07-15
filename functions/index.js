const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

function processarGasto(texto) {
    texto = texto.trim().toLowerCase();
    let tipo = 'despesa';

    if (/^\+|recebi|ganhei|salário|renda|vendi/i.test(texto)) tipo = 'receita';

    const valorEncontrado = texto.match(/\d+[,.]?\d*/);
    if (!valorEncontrado) return null;

    const valor = parseFloat(valorEncontrado[0].replace(',', '.'));
    let descricao = texto.replace(valorEncontrado[0], '').trim();

    let categoria = 'Outros';
    if (/mercado|padaria|restaurante/i.test(descricao)) categoria = 'Alimentação';
    if (/aluguel|luz|água|internet/i.test(descricao)) categoria = 'Moradia';
    if (/gasolina|uber|ônibus/i.test(descricao)) categoria = 'Transporte';
    if (/farmácia|médico/i.test(descricao)) categoria = 'Saúde';

    return {
        tipo,
        valor,
        descricao: descricao || 'Sem descrição',
        categoria,
        data: new Date().toLocaleDateString('pt-BR'),
        origem: 'whatsapp',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

exports.receberGastoWhats = functions.https.onRequest(async (req, res) => {
    const MEU_TOKEN = 'gastosapp12345';

    if (req.method === 'GET') {
        return req.query['hub.verify_token'] === MEU_TOKEN ? res.send(req.query['hub.challenge']) : res.sendStatus(403);
    }

    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.type === 'text') {
        const dados = processarGasto(msg.text.body);
        if (dados) {
            await db.collection('transacoes').add(dados);
            
            await fetch(`https://graph.facebook.com/v19.0/SEU_ID_CONTA/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer SEU_TOKEN_PERMANENTE',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: msg.from,
                    text: { body: `✅ Salvo!\n${dados.tipo === 'receita' ? '➕ Receita' : '➖ Despesa'}\nR$ ${dados.valor.toFixed(2).replace('.', ',')}\n${dados.descricao} - ${dados.categoria}` }
                })
            });
        }
    }
    res.sendStatus(200);
});