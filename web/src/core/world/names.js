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
    first: L('Lucas,Gabriel,Matheus,Caio,Renan,Felipe,Igor,Wesley,Leandro,Rodrigo,Gustavo,Heitor,Thales,Luan,Davi,Kauã,Murilo,Enzo'),
    last: L('Souza,Oliveira,Costa,Pereira,Almeida,Ferreira,Rodrigues,Barbosa,Araújo,Cavalcanti,Nascimento,Lacerda,Teixeira,Correia,Freitas,Pinto,Campos,Duarte'),
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
  // ── Ligi olmayan ama oyuncu yetiştiren ülkeler (yabancı oyuncular için). Ünlü futbolcuların soyadları konmadı.
  rs: {
    first: L('Nemanja,Stefan,Marko,Uroš,Lazar,Nikola,Miloš,Vuk,Dragan,Bogdan,Đorđe,Aleksa,Veljko,Strahinja,Luka,Ognjen,Mihajlo,Petar'),
    last: L('Jovanović,Petrović,Nikolić,Marković,Đorđević,Stojanović,Ilić,Popović,Simić,Lukić,Obradović,Radovanović,Vučković,Ristić,Todorović,Milenković,Gavrilović,Dimitrijević,Vasiljević,Bogdanović,Zarić,Lazarević'),
  },
  hr: {
    first: L('Ivan,Josip,Mario,Ante,Marin,Luka,Domagoj,Tomislav,Dario,Filip,Matej,Karlo,Petar,Stipe,Mislav,Lovro,Duje,Bruno'),
    last: L('Horvat,Kovač,Babić,Marić,Jurić,Novak,Knežević,Vuković,Pavlović,Blažević,Grgić,Perić,Tomić,Pavić,Bošnjak,Šarić,Matić,Lončar,Bilić,Galić'),
  },
  nl: {
    first: L('Daan,Sem,Lucas,Milan,Thijs,Jesse,Bram,Ruben,Stijn,Joris,Lars,Niels,Sven,Teun,Gijs,Jasper,Koen,Wout'),
    last: L('de Vries,Jansen,van den Berg,Bakker,Visser,Smit,Meijer,de Boer,Mulder,Bos,Vos,Peters,Hendriks,Dekker,van Leeuwen,Brouwer,de Graaf,Kuipers,Verhoeven,Willems'),
  },
  se: {
    first: L('Erik,Oscar,Hugo,Viktor,Isak,Linus,Albin,Anton,Filip,Gustav,Jonathan,Melker,Ludvig,Axel,Emil,Noah'),
    last: L('Lindqvist,Bergström,Holmberg,Sundberg,Nyström,Ekström,Lundgren,Sandberg,Wallin,Hedlund,Forsberg,Engström,Blomqvist,Åberg,Dahlberg,Sjöberg'),
  },
  no: {
    first: L('Magnus,Sander,Kristian,Henrik,Eirik,Jonas,Håkon,Sindre,Torbjørn,Aksel,Mathias,Even,Vegard,Ola,Sigurd,Tobias'),
    last: L('Johansen,Olsen,Larsen,Berg,Haugen,Hagen,Bakken,Solberg,Strand,Moen,Lund,Dahl,Aasen,Lie,Eide,Nygaard'),
  },
  cz: {
    first: L('Jakub,Tomáš,Ondřej,Lukáš,Matěj,Petr,Vojtěch,David,Adam,Jan,Filip,Michal,Daniel,Šimon,Radek,Martin'),
    last: L('Novák,Svoboda,Novotný,Dvořák,Černý,Procházka,Kučera,Veselý,Horák,Němec,Marek,Pokorný,Pospíšil,Hájek,Král,Jelínek'),
  },
  hu: {
    first: L('Bence,Máté,Dávid,Levente,Ádám,Balázs,Gergő,Zsolt,Kristóf,Botond,Márk,Dániel,Norbert,Péter,Attila,Tamás'),
    last: L('Nagy,Kovács,Tóth,Szabó,Horváth,Varga,Kiss,Molnár,Németh,Farkas,Balogh,Papp,Takács,Juhász,Lakatos,Mészáros'),
  },
  al: {
    first: L('Ardit,Elvis,Klajdi,Erion,Arlind,Besart,Dardan,Fatjon,Gentian,Ilir,Kristi,Lorik,Mergim,Redon,Valon,Endrit'),
    last: L('Hoxha,Krasniqi,Gashi,Berisha,Shala,Morina,Kelmendi,Rexhepi,Hasani,Bytyqi,Leka,Mehmeti,Zeqiri,Dervishi,Kastrati,Rama'),
  },
  ge: {
    first: L('Giorgi,Levan,Nika,Luka,Davit,Lasha,Saba,Irakli,Otar,Zurab,Guram,Beka,Tornike,Vakhtang,Lado,Gela'),
    last: L('Beridze,Kapanadze,Gelashvili,Mamaladze,Lomidze,Tsiklauri,Chikvaidze,Abashidze,Kiknadze,Gogoladze,Japaridze,Mchedlishvili,Natsvlishvili,Sharashenidze,Tabatadze,Zhvania'),
  },
  sn: {
    first: L('Moussa,Cheikh,Ibrahima,Mamadou,Ousmane,Pape,Abdoulaye,Babacar,Lamine,Alioune,Serigne,Modou,Assane,Bamba,Khadim,Malick'),
    last: L('Diop,Ndiaye,Fall,Sarr,Seck,Faye,Ba,Cissé,Sow,Diallo,Thiam,Gaye,Ndour,Mbaye,Diouf,Samb'),
  },
  ci: {
    first: L('Yao,Kouadio,Serge,Wilfried,Jean-Michel,Ismaël,Franck,Hervé,Didier,Arsène,Lassina,Souleymane,Christian,Bertrand,Junior,Salif'),
    last: L('Koné,Kouassi,Yao,Bamba,Touré,Coulibaly,Ouattara,Konan,Kouamé,Traoré,Diabaté,Gnagbo,Aka,Brou,Tanoh,Zadi'),
  },
  gh: {
    first: L('Kwame,Kofi,Kwabena,Yaw,Kojo,Kwaku,Emmanuel,Isaac,Ebenezer,Samuel,Daniel,Joseph,Prince,Richmond,Felix,Nana'),
    last: L('Mensah,Owusu,Boateng,Asante,Osei,Agyeman,Opoku,Darko,Amoah,Appiah,Frimpong,Antwi,Badu,Yeboah,Ofori,Sarpong'),
  },
  cm: {
    first: L('Jean-Pierre,Samuel,Eric,André,Vincent,Joël,Clinton,Georges,Patrick,Alain,Stéphane,Fabrice,Rigobert,Cédric,Landry,Arnaud'),
    last: L('Mbarga,Ngono,Atangana,Fouda,Essomba,Ndjock,Abena,Mvogo,Bilong,Owona,Elong,Manga,Ndongo,Tsala,Nkodo,Ebanda'),
  },
  co: {
    first: L('Juan,Andrés,Camilo,Santiago,Sebastián,Felipe,Jhon,Yerson,Wilmar,Brayan,Daniel,Mateo,Kevin,Duván,Jefferson,Óscar'),
    last: L('Restrepo,Gutiérrez,Montoya,Vargas,Mosquera,Murillo,Henao,Cárdenas,Palacios,Quintero,Arango,Ocampo,Mejía,Cortés,Angulo,Salazar'),
  },
  uy: {
    first: L('Matías,Federico,Agustín,Nicolás,Diego,Rodrigo,Facundo,Gastón,Maximiliano,Sebastián,Santiago,Bruno,Mathías,Joaquín,Emiliano,Franco'),
    last: L('Pereyra,Olivera,Silva,Rodríguez,Castro,Sosa,Correa,Acosta,Viera,Píriz,Techera,Rivero,Méndez,Olmedo,Barreto,Cabrera'),
  },
  mx: {
    first: L('José,Luis,Carlos,Jesús,Miguel,Alejandro,Fernando,Héctor,Jorge,Rodrigo,Uriel,Érick,Diego,Sebastián,Emilio,Iván'),
    last: L('Hernández,Ramírez,Cruz,Morales,Flores,Reyes,Gutiérrez,Ortiz,Chávez,Mendoza,Ruiz,Aguilar,Castillo,Vega,Salinas,Ibarra'),
  },
  ir: {
    first: L('Ali,Reza,Mehdi,Saeed,Hossein,Amir,Milad,Payam,Arash,Kaveh,Omid,Shahab,Vahid,Morteza,Ehsan,Sina'),
    last: L('Hosseini,Ahmadi,Rahimi,Karimi,Mohammadi,Rezaei,Jafari,Ghasemi,Mousavi,Sadeghi,Heidari,Nouri,Kazemi,Bagheri,Sharifi,Tehrani'),
  },
  in: {
    first: L('Arjun,Rohit,Vikram,Aditya,Rahul,Karan,Siddharth,Aman,Nikhil,Harsh,Pranav,Ishaan,Ankit,Yash,Kunal,Varun'),
    last: L('Sharma,Verma,Gupta,Singh,Patel,Reddy,Nair,Iyer,Menon,Rao,Kumar,Joshi,Mehta,Bose,Das,Pillai'),
  },
  bd: {
    first: L('Rafiq,Tanvir,Sakib,Mehedi,Arif,Shakil,Imran,Rakib,Sohel,Jamal,Nayeem,Tariq,Faisal,Rubel,Hasib,Shanto'),
    last: L('Hossain,Rahman,Islam,Ahmed,Chowdhury,Khan,Uddin,Alam,Karim,Miah,Sarkar,Talukder,Haque,Sheikh,Bhuiyan,Mondal'),
  },
  pk: {
    first: L('Hamza,Bilal,Usman,Zain,Ahsan,Faizan,Hassan,Saad,Waqas,Danish,Haris,Imad,Junaid,Shoaib,Talha,Umair'),
    last: L('Qureshi,Malik,Butt,Chaudhry,Raza,Abbasi,Siddiqui,Mirza,Javed,Iqbal,Sheikh,Awan,Rana,Bhatti,Gill,Hashmi'),
  },
  id: {
    first: L('Rizky,Bagus,Dimas,Fajar,Aditya,Yoga,Rendy,Andika,Bayu,Gilang,Ilham,Putra,Arif,Hendra,Dani,Wahyu'),
    last: L('Saputra,Pratama,Wijaya,Santoso,Hidayat,Nugroho,Kurniawan,Setiawan,Firmansyah,Ramadhan,Gunawan,Siregar,Lubis,Nasution,Harahap,Simanjuntak'),
  },
};

/** Yabancı oyuncuların çoğunlukla geldiği ülkeler (ağırlıklı); ligin ülkesine göre gerçekçi dağılım */
const FOREIGN_FROM = {
  default: [['br', 5], ['ar', 4], ['fr', 4], ['es', 3], ['pt', 3], ['rs', 3], ['hr', 3], ['nl', 3], ['sn', 3], ['ci', 2], ['gh', 2], ['ng', 3], ['co', 2], ['uy', 2], ['de', 2], ['en', 2], ['se', 1], ['no', 1], ['cz', 1], ['al', 1], ['ma', 2], ['cm', 2]],
  tr: [['br', 5], ['pt', 3], ['fr', 3], ['rs', 3], ['hr', 3], ['nl', 2], ['sn', 3], ['ng', 3], ['ci', 2], ['gh', 2], ['al', 2], ['ge', 2], ['cz', 1], ['de', 2], ['ar', 2], ['co', 2], ['uy', 1], ['ma', 2], ['ir', 1]],
  en: [['fr', 4], ['es', 3], ['pt', 3], ['br', 4], ['ar', 3], ['nl', 3], ['de', 2], ['no', 2], ['se', 2], ['sn', 2], ['ci', 2], ['gh', 2], ['ng', 2], ['hr', 1], ['rs', 1], ['uy', 2], ['co', 1], ['sc', 2], ['wa', 2]],
  es: [['ar', 5], ['br', 4], ['uy', 3], ['fr', 3], ['pt', 3], ['co', 2], ['mx', 2], ['hr', 1], ['rs', 1], ['ma', 2], ['sn', 1], ['nl', 1], ['de', 1]],
  it: [['ar', 4], ['br', 4], ['rs', 3], ['hr', 3], ['fr', 3], ['nl', 2], ['de', 2], ['se', 1], ['no', 1], ['ng', 2], ['ci', 2], ['sn', 2], ['uy', 2], ['al', 2], ['ge', 1]],
  de: [['fr', 3], ['nl', 3], ['hr', 2], ['rs', 2], ['cz', 2], ['hu', 2], ['br', 2], ['ar', 1], ['se', 2], ['no', 2], ['dk', 2], ['gh', 2], ['ci', 2], ['ng', 1], ['en', 2], ['al', 1]],
  fr: [['sn', 4], ['ci', 4], ['cm', 3], ['ma', 3], ['br', 3], ['pt', 2], ['ar', 2], ['nl', 1], ['gh', 2], ['ng', 2], ['es', 1], ['co', 1]],
  pt: [['br', 6], ['ar', 2], ['uy', 2], ['co', 2], ['es', 2], ['ng', 1], ['gh', 1], ['ci', 1], ['sn', 1], ['rs', 1], ['mx', 1]],
  sa: [['br', 5], ['pt', 3], ['fr', 2], ['ar', 2], ['eg', 3], ['ma', 3], ['sn', 2], ['ng', 2], ['es', 2], ['co', 2], ['rs', 1], ['hr', 1]],
  us: [['ar', 3], ['mx', 4], ['co', 3], ['br', 3], ['uy', 2], ['en', 2], ['fr', 1], ['es', 2], ['gh', 2], ['ng', 1], ['ca', 2]],
  cn: [['br', 6], ['ar', 2], ['pt', 2], ['co', 2], ['rs', 2], ['ng', 2], ['kr', 2], ['es', 1]],
  jp: [['br', 6], ['kr', 3], ['au', 0], ['es', 1], ['pt', 1], ['ng', 1], ['id', 1]],
  kr: [['br', 6], ['jp', 2], ['au', 0], ['rs', 1], ['pt', 1], ['co', 1]],
  ru: [['br', 3], ['rs', 3], ['ar', 2], ['co', 2], ['ua', 0], ['ge', 2], ['al', 1], ['ci', 1], ['ng', 1], ['ir', 1]],
};

/** Ligin yabancı oyuncu oranı: zengin ve üst ligler daha kozmopolit */
export function foreignShare(countryId, tier = 1, wage = 1) {
  const base = tier === 1 ? 0.18 + Math.min(0.3, (wage - 0.5) * 0.2) : tier === 2 ? 0.1 : 0.05;
  return countryId === 'tr' && tier === 1 ? 0.36 : Math.max(0.03, Math.min(0.5, base));
}

/** Yabancı oyuncunun isim havuzu (ağırlıklı) */
export function foreignLang(countryId, homeLang, rnd = Math.random) {
  const list = (FOREIGN_FROM[countryId] || FOREIGN_FROM.default).filter(([l, w]) => w > 0 && l !== homeLang && NAME_POOLS[l]);
  const tot = list.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * tot;
  for (const [l, w] of list) { r -= w; if (r <= 0) return l; }
  return list[0]?.[0] || 'en';
}

/** Gerçek ünlü futbolcu/teknik adamlarla birebir çakışan birleşimler üretilmez */
export const NAME_BLOCK = new Set(['Burak Yılmaz', 'Umut Bulut', 'Ahmet Kaya', 'Erol Bulut', 'Barış Yılmaz', 'Rui Costa', 'Diogo Costa', 'Nuno Gomes',
  'Ricardo Carvalho', 'Hugo Almeida', 'André Gomes', 'João Pereira', 'Ricardo Pereira', 'Diego López', 'Raúl García', 'Hugo Sánchez', 'Nicolás González',
  'Ezequiel Fernández', 'Matías Fernández', 'Lucas Pérez', 'Marco Rossi', 'Andrea Conti', 'Lorenzo Colombo', 'Andreas Christensen', 'Mathias Jensen',
  'Mikkel Hansen', 'Ryan Fraser', 'Gabriel Barbosa', 'Lucas Moura', 'Thiago Silva', 'Gonzalo Rodríguez', 'Franco Romero', 'Facundo Pérez']);

/** Ülke → isim havuzu */
export const poolFor = (lang) => NAME_POOLS[lang] || NAME_POOLS.tr;

/**
 * Rastgele kurgusal oyuncu adı.
 * @param {string} lang isim havuzu (ülkenin lang alanı)
 * @param {() => number} rnd
 */
export function randomName(lang, rnd = Math.random) {
  const p = poolFor(lang);
  let name = '';
  for (let i = 0; i < 12 && (!name || NAME_BLOCK.has(name)); i++) {
    const f = p.first[Math.floor(rnd() * p.first.length)];
    const l = p.last[Math.floor(rnd() * p.last.length)];
    name = p.order === 'lf' ? `${l} ${f}` : `${f} ${l}`;
  }
  return name;
}
