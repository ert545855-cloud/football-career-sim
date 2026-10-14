// OYUNCU İSİM HAVUZLARI — ülkeye göre kurgusal futbolcu adları (kadrolar, transferler, gol atanlar).
// Ünlü gerçek futbolcularla birebir eşleşmemesi için bilinen soyadlar havuza konmadı.

const L = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** order: 'fl' = ad soyad, 'lf' = soyad ad (Doğu Asya) */
export const NAME_POOLS = {
  tr: {
    first: L('Arda,Kerem,Emir,Yusuf,Mert,Burak,Efe,Barış,Ozan,Deniz,Kaan,Umut,Eren,Tuna,Alp,Berat,Çınar,Ege,Poyraz,Aras,Ferhat,Ercan,Tamer,Levent,Yavuz,Kadir,Orhan,Erhan,Sedat,Taner,Koray,Serdar'),
    last: L('Yılmaz,Kaya,Demir,Çelik,Şahin,Aydın,Öztürk,Arslan,Doğan,Koç,Kurt,Aksoy,Polat,Erdem,Tekin,Güneş,Yıldırım,Karaca,Toprak,Bozkurt,Uçar,Akın,Ateş,Duman,Kılıç,Özkan,Bulut'),
  },
  en: {
    first: L('James,Oliver,Harry,Jack,Charlie,Thomas,George,Liam,Callum,Ryan,Connor,Lewis,Owen,Dylan,Mason,Tyler,Ethan,Nathan,Kieran,Jamie,Alfie,Reece'),
    last: L('Walker,Taylor,Hughes,Clarke,Turner,Mitchell,Bennett,Fletcher,Parker,Hayes,Cooper,Ward,Barnes,Graham,Morris,Foster,Holloway,Pearce,Whitaker,Ashworth,Lambert,Hargreaves'),
  },
  sc: {
    first: L('Callum,Ross,Euan,Fraser,Craig,Ryan,Scott,Lewis,Jamie,Calum,Kyle,Murray,Angus,Blair,Finlay,Grant'),
    last: L('MacLeod,Campbell,Stewart,Murray,Reid,MacDonald,Fraser,Duncan,Henderson,McKay,Sinclair,Buchanan,Cameron,Gillespie,Kerr,Munro'),
  },
  wa: {
    first: L('Rhys,Dafydd,Gethin,Owain,Iwan,Dylan,Tomos,Huw,Ieuan,Gareth,Ryan,Jac,Cai,Elis,Osian,Aled'),
    last: L('Jones,Evans,Price,Pryce,Lloyd,Griffiths,Morgan,Hughes,Powell,Rees,Owen,Pritchard,Vaughan,Bowen,Howells,Llewellyn'),
  },
  us: {
    first: L('Tyler,Brandon,Cody,Austin,Jordan,Logan,Hunter,Mason,Chase,Cole,Diego,Carlos,Luis,Jaden,Malik,Trey,Brody,Gavin'),
    last: L('Johnson,Miller,Davis,Anderson,Thompson,Martinez,Hernandez,Robinson,Lewis,Walker,Young,Allen,Hill,Brooks,Reyes,Flores,Coleman,Jenkins'),
  },
  ca: {
    first: L('Liam,Noah,Jacob,Ethan,Logan,Owen,Félix,Antoine,Mathieu,Samuel,Gabriel,Olivier,Jayden,Marcus,Nathaniel,Dominic'),
    last: L('Tremblay,Gagnon,Roy,Côté,Bouchard,Gauthier,Morin,Lavoie,Fortin,MacDonald,Campbell,Stewart,Wilson,Martin,Bélanger,Leblanc'),
  },
  es: {
    first: L('Javier,Alejandro,Pablo,Diego,Álvaro,Iker,Marcos,Rubén,Adrián,Hugo,Mario,Raúl,Joaquín,Mateo,Nicolás,Gonzalo,Unai,Aitor,Borja,Óscar'),
    last: L('García,Fernández,López,Martín,Sánchez,Romero,Navarro,Torres,Domínguez,Vázquez,Gil,Serrano,Blanco,Molina,Morales,Ortega,Delgado,Castro,Rubio,Medina'),
  },
  ar: {
    first: L('Facundo,Nicolás,Gonzalo,Matías,Franco,Santiago,Tomás,Agustín,Joaquín,Ezequiel,Mauro,Lucas,Bruno,Ignacio,Maximiliano,Thiago'),
    last: L('González,Rodríguez,Fernández,Gómez,Díaz,Pérez,Sosa,Romero,Benítez,Acosta,Ferraro,Lombardi,Bianchi,Ruiz,Ledesma,Quiroga'),
  },
  pt: {
    first: L('João,Pedro,Tiago,Rui,Diogo,Gonçalo,André,Rafael,Ricardo,Hugo,Nuno,Miguel,Duarte,Fábio,Vasco,Salvador'),
    last: L('Pereira,Oliveira,Costa,Rodrigues,Almeida,Ferreira,Carvalho,Gomes,Martins,Barbosa,Ribeiro,Cardoso,Teixeira,Moreira,Nunes,Lopes,Rocha,Batista'),
  },
  br: {
    first: L('Lucas,Gabriel,Matheus,Caio,Renan,Felipe,Igor,Wesley,Leandro,Rodrigo,Gustavo,Vitor,Thales,Luan,Davi,Kauã,Murilo,Enzo'),
    last: L('Souza,Oliveira,Costa,Pereira,Almeida,Ferreira,Rodrigues,Barbosa,Araújo,Cavalcanti,Nascimento,Moura,Teixeira,Correia,Freitas,Pinto,Campos,Duarte'),
  },
  de: {
    first: L('Lukas,Jonas,Felix,Leon,Niklas,Tim,Jan,Florian,Maximilian,Moritz,Tobias,Fabian,Dennis,Sebastian,Julian,Paul,Elias,Nico,Lennart,Malte'),
    last: L('Schneider,Fischer,Weber,Wagner,Becker,Hoffmann,Schäfer,Koch,Bauer,Richter,Klein,Wolf,Schröder,Neumann,Schwarz,Zimmermann,Braun,Hartmann,Krüger,Lange'),
  },
  it: {
    first: L('Luca,Marco,Andrea,Matteo,Lorenzo,Alessandro,Francesco,Davide,Simone,Federico,Riccardo,Gabriele,Stefano,Nicolò,Tommaso,Pietro,Giacomo,Daniele,Filippo,Emanuele'),
    last: L('Rossi,Russo,Ferrari,Esposito,Bianchi,Romano,Colombo,Ricci,Marino,Greco,Gallo,Conti,De Luca,Giordano,Rizzo,Lombardi,Moretti,Fontana,Barbieri,Caruso'),
  },
  fr: {
    first: L('Lucas,Hugo,Théo,Louis,Nathan,Enzo,Mathis,Clément,Maxime,Julien,Romain,Quentin,Yanis,Bastien,Rayan,Florian,Adrien,Malik,Sacha,Noé'),
    last: L('Martin,Bernard,Dubois,Durand,Lefebvre,Moreau,Simon,Michel,Garnier,Fontaine,Rousseau,Guérin,Faure,Mercier,Chevalier,Lambert,Bonnet,Girard,Perrin,Marchand'),
  },
  dk: {
    first: L('Mads,Rasmus,Mikkel,Jonas,Andreas,Emil,Frederik,Mathias,Nikolaj,Magnus,Lasse,Viktor,Anders,Jesper,Malthe,Søren'),
    last: L('Nielsen,Jensen,Hansen,Pedersen,Andersen,Christensen,Larsen,Sørensen,Rasmussen,Jørgensen,Madsen,Kristensen,Olsen,Thomsen,Poulsen,Mortensen'),
  },
  ru: {
    first: L('Ivan,Dmitri,Alexei,Sergei,Nikita,Artyom,Maxim,Kirill,Andrei,Pavel,Roman,Yegor,Denis,Vladislav,Mikhail,Ilya,Anton,Gleb,Timur,Fyodor'),
    last: L('Ivanov,Smirnov,Kuznetsov,Popov,Volkov,Sokolov,Lebedev,Kozlov,Novikov,Morozov,Petrov,Orlov,Fedorov,Belov,Zaitsev,Pavlov,Semyonov,Golubev,Vinogradov,Bogdanov'),
  },
  ua: {
    first: L('Oleksandr,Andriy,Mykola,Taras,Bohdan,Yaroslav,Vitaliy,Serhiy,Dmytro,Ihor,Maksym,Artem,Yurii,Ostap,Danylo,Nazar,Vasyl,Oleh'),
    last: L('Kovalenko,Bondarenko,Tkachenko,Kravchenko,Melnyk,Boyko,Lysenko,Rudenko,Savchenko,Petrenko,Marchenko,Moroz,Polishchuk,Kovalchuk,Klymenko,Hrytsenko,Fedorchuk,Danylyuk'),
  },
  pl: {
    first: L('Jakub,Kacper,Mateusz,Michał,Bartosz,Kamil,Tomasz,Łukasz,Krzysztof,Wojciech,Paweł,Szymon,Dawid,Patryk,Marcin,Filip,Damian,Igor'),
    last: L('Nowak,Kowalski,Wiśniewski,Wójcik,Kowalczyk,Kamiński,Szymański,Woźniak,Dąbrowski,Kozłowski,Jankowski,Mazur,Kwiatkowski,Krawczyk,Grabowski,Pawłowski,Michalski,Nowicki'),
  },
  gr: {
    first: L('Giorgos,Dimitris,Nikos,Kostas,Giannis,Panagiotis,Christos,Vasilis,Thanasis,Stelios,Michalis,Alexandros,Petros,Spyros,Manolis,Antonis,Lefteris,Sotiris'),
    last: L('Papadopoulos,Georgiou,Nikolaidis,Papadakis,Konstantinou,Dimitriou,Vlachos,Antoniou,Ioannidis,Karagiannis,Pappas,Oikonomou,Makris,Christodoulou,Alexiou,Stavrou,Galanis,Mavridis'),
  },
  ro: {
    first: L('Andrei,Alexandru,Ionuț,Mihai,Cristian,Florin,Răzvan,Bogdan,Adrian,Vlad,Darius,Sorin,Marius,Cosmin,Ștefan,Tudor,Radu,Claudiu'),
    last: L('Popescu,Ionescu,Popa,Stan,Dumitru,Stoica,Gheorghe,Matei,Constantin,Marin,Rusu,Munteanu,Lazăr,Florea,Toma,Neagu,Dobre,Nistor'),
  },
  sa: {
    first: L('Mohammed,Abdullah,Faisal,Fahad,Nasser,Saleh,Khalid,Sultan,Turki,Saud,Bandar,Hamad,Majed,Yasser,Nawaf,Rakan'),
    last: L('Al-Harbi,Al-Qahtani,Al-Otaibi,Al-Ghamdi,Al-Shahrani,Al-Mutairi,Al-Zahrani,Al-Juhani,Al-Anazi,Al-Malki,Al-Subaie,Al-Rashidi,Al-Shammari,Al-Amri,Al-Asmari,Al-Hazmi'),
  },
  eg: {
    first: L('Ahmed,Mohamed,Omar,Mostafa,Amr,Karim,Tarek,Hossam,Mahmoud,Youssef,Ali,Hazem,Ziad,Marwan,Sherif,Khaled'),
    last: L('Hassan,Mansour,Abdelrahman,El-Sayed,Fathy,Gaber,Hamdi,Ashour,Ragab,Shehata,Farouk,Saber,Nabil,Zaki,Fouad,Magdy'),
  },
  ma: {
    first: L('Ayoub,Youssef,Hamza,Anas,Achraf,Soufiane,Ilias,Zakaria,Bilal,Mehdi,Reda,Adam,Ismail,Nabil,Walid,Othmane'),
    last: L('Benali,El Idrissi,Bennani,Amrani,Tazi,Ouali,Chraibi,Alaoui,Berrada,El Fassi,Belhaj,Ziani,Boukhari,Lahlou,Kettani,Mansouri'),
  },
  ng: {
    first: L('Chinedu,Emeka,Oluwaseun,Tunde,Ikechukwu,Uche,Abubakar,Segun,Femi,Chidi,Samuel,Ifeanyi,Babatunde,Obinna,Kunle,Musa,Godwin,Daniel'),
    last: L('Okafor,Adeyemi,Okonkwo,Eze,Nwosu,Balogun,Adebayo,Oyelaran,Chukwu,Okeke,Bello,Olawale,Nnamdi,Afolabi,Ogunleye,Udoh,Ekwueme,Abiodun'),
  },
  za: {
    first: L('Thabo,Sipho,Themba,Lebo,Bongani,Mandla,Kagiso,Siyabonga,Lwazi,Tumelo,Tshepo,Ruan,Pieter,Luyanda,Sibusiso,Teboho,Katlego,Mpho'),
    last: L('Nkosi,Dlamini,Mokoena,Ndlovu,Khumalo,Mthembu,Zulu,Sithole,Mahlangu,Molefe,van der Merwe,Botha,Pretorius,Mabaso,Ngcobo,Masilela,Modise,Mokwena'),
  },
  cn: {
    order: 'lf',
    first: L('Wei,Hao,Lei,Jun,Tao,Peng,Bo,Jie,Yu,Xin,Hang,Kai,Ming,Long,Rui,Feng,Chao,Yi,Zhen,Qiang'),
    last: L('Wang,Li,Zhang,Liu,Chen,Yang,Huang,Zhao,Wu,Zhou,Xu,Sun,Ma,Zhu,Hu,Guo,He,Lin,Gao,Luo'),
  },
  jp: {
    first: L('Haruto,Ren,Yuto,Sota,Riku,Kaito,Daiki,Takumi,Shota,Kenta,Yuma,Ryota,Hiroki,Naoki,Kazuki,Sho,Taiga,Kota,Yuki,Ryo'),
    last: L('Sato,Suzuki,Takahashi,Tanaka,Watanabe,Ito,Yamamoto,Nakamura,Kobayashi,Kato,Yoshida,Yamada,Sasaki,Yamaguchi,Matsumoto,Inoue,Kimura,Hayashi,Shimizu,Mori'),
  },
  kr: {
    order: 'lf',
    first: L('Min-jun,Seo-jun,Do-yoon,Ji-ho,Joon-young,Hyun-woo,Ji-hoon,Seung-ho,Tae-yang,Dong-hyun,Sung-min,Jae-won,Woo-jin,Kyung-min,Sang-hoon,Jin-woo,Hyun-jun,Chan-ho'),
    last: L('Kim,Lee,Park,Choi,Jung,Kang,Cho,Yoon,Jang,Lim,Han,Oh,Seo,Shin,Kwon,Hwang,Ahn,Song'),
  },
};

/** Ülke → isim havuzu */
export const poolFor = (lang) => NAME_POOLS[lang] || NAME_POOLS.tr;

/**
 * Rastgele kurgusal oyuncu adı.
 * @param {string} lang isim havuzu (ülkenin lang alanı)
 * @param {() => number} rnd
 */
export function randomName(lang, rnd = Math.random) {
  const p = poolFor(lang);
  const f = p.first[Math.floor(rnd() * p.first.length)];
  const l = p.last[Math.floor(rnd() * p.last.length)];
  return p.order === 'lf' ? `${l} ${f}` : `${f} ${l}`;
}
