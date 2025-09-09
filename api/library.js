import clientPromise from './util/mongodb.js';

const DEFAULT_EXERCISE_LIBRARY = {
    "Pecho": [
        { name: "Apertura con Banda", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757101381/aperturaBanda_bhukpv.mp4" },
        { name: "Apertura con Mancuernas en Banco Declinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757101336/aperturaBancoDeclinado_jj4hxl.mp4" },
        { name: "Apertura con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102276/aperturaBancoDeclinado_ni0r06.mp4" },
        { name: "Apertura con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757101395/aperturaPlana_s1bxp0.mp4" },
        { name: "Apertura en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107294/peckdeck_pcppcv.mp4" },
        { name: "Apertura en Máquina Inclinada", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107410/maquinaAperturaInclinada_pkvtmy.mp4" },
        { name: "Banco Hammer", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107508/BancoHammer_s4ovac.mp4" },
        { name: "Cruce en Polea Alta", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107639/Crucepoleaalta_hfluon.mp4" },
        { name: "Cruce en Polea Inferior", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107705/crucepoleainferior_szdmtc.mp4" },
        { name: "Cruce en Polea Medio", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757107774/crucepoleamedio_wohlp6.mp4" },
        { name: "Empuje en Press de Banca con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102287/empujePressBancaMancuerna_raowcy.mp4" },
        { name: "Flexiones (Push Up)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102288/flexionesDeBrazosConLiberacionDeManos_ji7c4e.mp4" },
        { name: "Flexiones con Agarre Cerrado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102288/flexionesConAgarreCerrado_y2xrqd.mp4" },
        { name: "Flexiones con Liberación de Manos", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102288/flexionesDeBrazosConLiberacionDeManos_ji7c4e.mp4" },
        { name: "Flexiones en Paralela", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757106220/flexionTricepsEnParalelasConAgarreCerrado_snn7c3.mp4" },
        { name: "Hammer Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102294/hammerInclinado_ifb1vz.mp4" },
        { name: "Hammer Inclinado Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102294/hamerDeclinadoSentado_lacsqb.mp4" },
        { name: "Máquina Press de Pecho", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108057/maquinapressPecho_hgfdk1.mp4" },
        { name: "Peck Deck Cerrado (Mariposa)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108162/peckDeckApoyo_va1igj.mp4" },
        { name: "Press con Mancuernas en Banco Declinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108260/pechoDeclinadoMancuernas_lsi6jx.mp4" },
        { name: "Press con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108379/pressPechoInclinado_z0ykkd.mp4" },
        { name: "Press con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108483/pechoPlanoMancuernas_mzx3rv.mp4" },
        { name: "Press de Pecho Acostado en el Piso", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108561/pressPechoEnPiso_kwiyay.mp4" },
        { name: "Press de Pecho Declinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102278/bancoDeclinado_hyko8d.mp4" },
        { name: "Press de Pecho en Banco Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102280/bancoPlano_am9dbm.mp4" },
        { name: "Press de Pecho en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108711/pressBancaSmith_bwu8xl.mp4" },
        { name: "Press de Pecho Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757101420/bancoInclinado_ht7cp8.mp4" },
        { name: "Press de Pecho Inclinado en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108813/pechoInclinadoSmith_pmdex0.mp4" },
        { name: "Press de Pecho Vertical", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108891/pressVerticalpecho_exy8zg.mp4" },
        { name: "Press de Pecho Vertical con Disco", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757108952/pressPechoVerticalDisco_cdatud.mp4" },
        { name: "Press Hammer Declinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109063/pressHammerDeclinado_dutstu.mp4" },
        { name: "Press Hammer Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109183/pressHammerInclinado_v4ganr.mp4" },
        { name: "Press Hammer Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109257/pressHammerPlano_zm4szd.mp4" },
        { name: "Push Up con Palmada (Clap)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109356/pushUppalmada_wx1xa5.mp4" },
        { name: "Push Up Diamante", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109423/pushUpDiamond_kyjpfu.mp4" },
        { name: "Push Up Lateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109484/pushUpLateral_ojiktn.mp4" }
    ],
    "Espalda": [
        { name: "Banco de Espinales", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109707/GHDespinales_u3fdtf.mp4" },
        { name: "Dominadas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102374/dominadas_sefila.mp4" },
        { name: "Dominadas Abiertas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102373/dominadasAbiertas_gjg2lz.mp4" },
        { name: "Dominadas Asistidas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102374/dominadasAsistidas_qxjstd.mp4" },
        { name: "Dominadas Cerradas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102376/dominadasCerradas_gdwbgx.mp4" },
        { name: "Dorsalera Fija Tracción Vertical", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757109922/verticalTractionMachine_ey2qys.mp4" },
        { name: "Dorsalera Fija Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110019/Dorsalerafijaunilateral_muxf1m.mp4" },
        { name: "Dorsalera Frontal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102379/dorsaleraFrontal_wlk1ap.mp4" },
        { name: "Dorsalera Tras Nuca", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110119/dorsaleraTrasnuca_slbte6.mp4" },
        { name: "Encogimiento de Hombros con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102380/encogimientoHombroBarra_odmanb.mp4" },
        { name: "Encogimiento de Hombros con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102383/encogimientoHombros_kv2c14.mp4" },
        { name: "Encogimiento de Hombros en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110758/trapecioMaquina_reedph.mp4" },
        { name: "Encogimiento de Hombros en Shrug", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102391/encogimientoHombreShrug_e60qdm.mp4" },
        { name: "Giro Oblicuo con Barra en Tierra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110825/giroOblicuioConBarraEnTierra_hwtk41.mp4" },
        { name: "Good Morning con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110920/goodMorningBarra_kfyonu.mp4" },
        { name: "Jalón a la Cara Supino", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757110992/jalonSupinoAlPecho_py6hyl.mp4" },
        { name: "Jalón Abierto en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757111048/jalonAbiertoIndividual_yozvg6.mp4" },
        { name: "Jalón al Pecho (Dorsalera)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102376/dorsalera_cocdrj.mp4" },
        { name: "Jalón Dorsal en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757111174/Jalondorsalenpolea_dkhazx.mp4" },
        { name: "Jalón Frontal (a la cara)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757111231/jalondorsalalaCara_ud8jmc.mp4" },
        { name: "Máquina de Pullover", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757111474/maquinaPullover_jvisci.mp4" },
        { name: "Máquina Lumbar", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757162047/maquinaLumbar_g4suth.mp4" },
        { name: "Postura de Superman Sostenido", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757162107/supermanSostenido_hb38zj.mp4" },
        { name: "Posteriores Pull Face", isEnabled: true, videoUrl: "" },
        { name: "Pullover en Polea Alta", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102387/espaldaPolea_gp5msm.mp4" },
        { name: "Remo a Caballo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102370/barraDorsal_uijunw.mp4" },
        { name: "Remo a Caballo con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757162383/remoConBarraEnT_hhmrdd.mp4" },
        { name: "Remo al Mentón con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167137/remoVerticalBarra_tepxwh.mp4" },
        { name: "Remo al Mentón con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165114/remoMentonMancuerna_b1ogkh.mp4" },
        { name: "Remo al Mentón con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165184/remoMentonconpolea_vpg2nz.mp4" },
        { name: "Remo al Mentón en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757163938/remoalmentonsmith_zihjmq.mp4" },
        { name: "Remo Bajo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165285/remo_u3z2m7.mp4" },
        { name: "Remo con Banda", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165384/remoBanda_xbvkgc.mp4" },
        { name: "Remo con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165461/remoBarra_vw5euu.mp4" },
        { name: "Remo con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757165537/remoMancuerna_nz7hs4.mp4" },
        { name: "Remo de Pie con Polea Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166217/remoPieUnaMano_okl907.mp4" },
        { name: "Remo en T Agarre Cerrado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166296/remoCaballoLandmine_vaqjfe.mp4" },
        { name: "Remo Gorilla", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166354/remoGorila_txyrks.mp4" },
        { name: "Remo Hammer Bajo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166435/remoHammerBajo_lzvjab.mp4" },
        { name: "Remo Invertido en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166560/remoInvertido_a8bmyb.mp4" },
        { name: "Remo Landmine Agarre Cerrado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166296/remoCaballoLandmine_vaqjfe.mp4" },
        { name: "Remo Prono con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166661/remoPronoConMancuernas_vaqjnq.mp4" },
        { name: "Remo Prono con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166725/remoPronoConMancuernasRecto_cqf58f.mp4" },
        { name: "Remo Renegado con Flexión", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166792/remoRenegado_op6vzm.mp4" },
        { name: "Remo Sentado Agarre Abierto", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166853/remoSentadoAbierto_nsxvax.mp4" },
        { name: "Remo Sentado con Agarre Cerrado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166925/remoSentadoCerrado_kcuayz.mp4" },
        { name: "Remo Shrug", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757166984/remoShrug_x9uez0.mp4" },
        { name: "Remo T Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167058/remoTunilateral_mxk217.mp4" },
        { name: "Remo Vertical con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167137/remoVerticalBarra_tepxwh.mp4" },
        { name: "Rotación de Cintura", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167202/rotacionCintura_qgtn2u.mp4" },
        { name: "Simulador de Remo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167250/simuladorRemo_nb5tno.mp4" }
    ],
    "Hombros": [
        { name: "Antebrazo con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167577/antebrazoPolea_nfoaux.mp4" },
        { name: "Arnold Press Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102420/arnoldPressSentado_mznorg.mp4" },
        { name: "Banco Press de Hombro", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102421/bancoPressHombro_ipwwmz.mp4" },
        { name: "Deltoides en Polea Cruzada", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167665/cruzadasPoleaAlta_c7wf55.mp4" },
        { name: "Elevación Posterior con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102423/elevacionPosteriorMancuerna_bz9f8q.mp4" },
        { name: "Elevación Posterior con Polea Baja", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102420/elevacionesPosterioresPoleaBaja_bzvhq8.mp4" },
        { name: "Máquina de Vuelos Laterales", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167850/maquinaVueloLateral_nqpw7j.mp4" },
        { name: "Máquina de Vuelos Laterales de Pie", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167911/maquinaVuelosLaterales_fmjrv2.mp4" },
        { name: "Posteriores en Máquina de Apertura", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757167984/posterioresEnMaquinaApertura_uujloq.mp4" },
        { name: "Press de Hombros", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168115/hombrosPress_fhthjy.mp4" },
        { name: "Press de Hombros Agarre Neutro", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168219/pressHombroSentadoAgarraNeutro_kzk47e.mp4" },
        { name: "Press de Hombros con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168271/hombrosPressBarra_cvdhzb.mp4" },
        { name: "Press de Hombros con Mancuernas Arrodillado Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168449/pressDeHombroConMancuernaArrodillado_rkuhjg.mp4" },
        { name: "Press de Hombros en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168534/hombrosPressSmith_qreuan.mp4" },
        { name: "Press de Hombros Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168067/pressHombroInclinado_k5hheo.mp4" },
        { name: "Press de Hombros Sentado con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168622/pressHombroBarra_h0nfso.mp4" },
        { name: "Press de Hombros Sentado con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168679/pressHombroMancuernaSentado_gbq1my.mp4" },
        { name: "Press Militar Sentado con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168813/pressMilitarSentadoMancuerna_r3lskg.mp4" },
        { name: "Press Trasnuca con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168877/pressNucaBarra_gusn8f.mp4" },
        { name: "Vuelos Frontales Alternados", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757168990/vueloFrontalAlternado_ngezfc.mp4" },
        { name: "Vuelos Frontales con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169070/vueloFrontalBarra_hh6rof.mp4" },
        { name: "Vuelos Frontales con Discos", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169133/vueloFrontalDisco_wluven.mp4" },
        { name: "Vuelos Frontales con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169185/vueloFrontalPolea_muuh74.mp4" },
        { name: "Vuelos Laterales", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169244/vueloLateral_gyhecv.mp4" },
        { name: "Vuelos Laterales con Polea", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Laterales Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169334/vuelosLateralesSentado_rt30yi.mp4" },
        { name: "Vuelos Posteriores", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169395/vuelosPosteriores_eowhen.mp4" },
        { name: "Vuelos Posteriores en Banco Inclinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169431/vuelosPosterioresEnBancoInclinado_rsewjo.mp4" }
    ],
    "Cuádriceps": [
        { name: "Arranque (Snatch)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102452/arranqueSnatch_b8ycbx.mp4" },
        { name: "Búlgaras en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102456/bulgaraMaquina_vlemvt.mp4" },
        { name: "Descenso a un Pie en Landmine", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757197968/descensoUnPieLandmine_dfotao.mp4" },
        { name: "Estocada con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102455/estocadaBarra_a67pxx.mp4" },
        { name: "Estocada con Salto", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102463/estocadaSaltoConApoyo_l0u9fi.mp4" },
        { name: "Estocada en Landmine", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102460/estocadaLandmine_eaeiwk.mp4" },
        { name: "Estocada en Shrug", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102468/estocadaShrug_ugdvln.mp4" },
        { name: "Estocada en Shrug con Apoyo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102454/estocadaApoyoShrug_ls9azq.mp4" },
        { name: "Estocada Paso Atrás con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102460/estocadaPasoAtrasMancuerna_nsira7.mp4" },
        { name: "Estocada Trasera con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198362/estocadaTraseraBarra_eugn7j.mp4" },
        { name: "Estocadas con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102465/estocadasConMancuerna_sykxsf.mp4" },
        { name: "Hack Squat (Sentadilla Hammer)", isEnabled: true, videoUrl: "" },        
        { name: "Hack", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198482/hack_rxfyyj.mp4" },
        { name: "Hack con Apoyo en Cintura", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198533/hackApoyoCintura_j0iwhb.mp4" },
        { name: "Hack Horizontal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198791/hackHorizontal_vhnznc.mp4" },
        { name: "Hack Horizontal Acostado", isEnabled: true, videoUrl: "" },
        { name: "Hack Invertida (Sentadilla Hammer)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198878/hackInvertida_cd89ky.mp4" },
        { name: "Máquina de Sumo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198937/sumoMaquinaCentral_t30urz.mp4" },
        { name: "Máquina de Sumo Agarre Cintura", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757198990/sumoMaquina_reajtf.mp4" },
        
        { name: "Máquina Sentadilla Perfecta", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199180/sentadillaPerfecta_jndgkw.mp4" },
        { name: "Push Press con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177448/pushPressBarra_sjjchd.mp4" },
        { name: "Prensa 180º", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199231/prensa180_drjwv7.mp4" },
        { name: "Prensa 45º Fija", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199286/prensa45_tzdlql.mp4" },
        { name: "Prensa 45º Fija Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199319/prensa45Unilateral_vgzmcy.mp4" },
        { name: "Prensa 90º", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199344/prensa90_wmphol.mp4" },
        { name: "Prensa Basculante", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199399/prensaBasculante_gewmnr.mp4" },
        { name: "Prensa Horizontal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199503/prensaHorizontal_ob4bon.mp4" },
        { name: "Prensa Oscilante", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199549/prensa_k6n1x7.mp4" },
        
        { name: "Salto al Cajón", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199660/saltoCajon_ikukvn.mp4" },
        { name: "Sentadilla (Squat)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199784/squat_bcx5yp.mp4" },
        { name: "Sentadilla a 45º con Apoyo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199874/sentadilla45Apoyo_adjzwm.mp4" },
        { name: "Sentadilla con Apoyo en Pared", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199933/sentadillaEnPared_zut1gu.mp4" },
        { name: "Sentadilla con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757199979/sentadillaBarra_ooin2c.mp4" },
        { name: "Sentadilla Cossack con Peso", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200087/sentadillaCossackConPeso_dve0ee.mp4" },
        { name: "Sentadilla con Salto (Jumping Squat)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200228/squatJump_qiyvk9.mp4" },
        
        
        { name: "Sentadilla en Smith", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200372/sentadillaBarraSmith_pztei1.mp4" },
        { name: "Sentadilla Frontal con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200484/sentadillafrontalbarra_tdsnnm.mp4" },
        { name: "Sentadilla Goblet", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200639/sentadillagoblet_mcuuuj.mp4" },
        { name: "Sentadilla Isométrica", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Landmine", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200848/flexionLandmine_ghk80k.mp4" },
        { name: "Sentadilla Péndulo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200911/sentadillaPendulo_ymraul.mp4" },
        { name: "Sentadilla Sissy", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757200957/sentadillaSissy_whbtlw.mp4" },
        { name: "Sentadilla Sumo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757335253/sentadillaSumoMancuerna_rtavqt.mp4" },        
        { name: "Sentadilla Sumo con barra", isEnabled: true, videoUrl: "" },
        { name: "Sillón de Cuádriceps (Extensión de Rodilla)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757335420/sillonCuadriceps_vk3ae8.mp4" },
        { name: "Sillón de Cuádriceps Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757335456/sillonCuadricepUnilateral_d5tcjb.mp4" },
        { name: "Zancada con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757335514/splitSuat_qastfu.mp4" },
        { name: "Zancada Isométrica", isEnabled: true, videoUrl: "" },
        { name: "Zancada Lateral", isEnabled: true, videoUrl: "" },
        { name: "Zancada Lateral con Alcance", isEnabled: true, videoUrl: "" },
        { name: "Zancadas (Lunges)", isEnabled: true, videoUrl: "" },

    ],
    "Femorales e Isquiotibiales": [
        { name: "Camilla de Femorales", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171799/isquiotibiales_jhdnnl.mp4" },
        { name: "Camilla de Femorales Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102491/camillaFemoralUnilateral_wzcuta.mp4" },
        { name: "Curl Femoral en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102492/curlFemoralPolea_tcyicf.mp4" },
        { name: "Femorales de Pie", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102495/femorales_xnnmp0.mp4" },
        { name: "Femorales Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102496/femoralesSentado_x9lf2i.mp4" },
        { name: "Máquina Curl Femoral Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102493/curlFemoralUnilateral_i9ywbn.mp4" }
    ],
    "Glúteos": [
        { name: "Abducción Lateral de Glúteo", isEnabled: true, videoUrl: "" },
        { name: "Abducción Lateral de Glúteo 90º", isEnabled: true, videoUrl: "" },
        { name: "Banco Hip Thrust", isEnabled: true, videoUrl: "" },
        { name: "Caminata de Peso Muerto", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174892/marchaDeIsquiotibiales_qoctyo.mp4" },
        { name: "Cuadrupedia Patada Atrás (Back Kick)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175039/cuadrupediaBackKick_dywmum.mp4" },
        { name: "Cuadrupedia Patada Lateral (Lateral Kick)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175116/cuadrupediaLateralKick_b9extn.mp4" },
        { name: "Cuadrupedia Patada Lateral 90º", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175192/cuadrupediaLateralKick90_xpq9fq.mp4" },
        { name: "Empuje de Caderas con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102530/empujeDeCaderasConMancuernas_qvxeot.mp4" },
        { name: "Extensión de Tronco", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175316/hiperextencionesdetronco_cgxein.mp4" },
        { name: "Hip Thrust", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175415/Hipthrust_lymzn1.mp4" },
        { name: "Hip Thrust a una Pierna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175547/hipthrustOneLeg_frbmbi.mp4" },
        { name: "Hip Thrust con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102529/empujeCaderaBarra_unyobf.mp4" },
        { name: "Hip Thrust en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102527/elevacionCaderaMaquina_ifndkj.mp4" },
        { name: "Hip Thrust Rana (Frog)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175683/hipthrustFrog_gxbswc.mp4" },
        { name: "Hip Thrust Semiflexión", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757175740/hipThrustSemiflexion_gz1cgh.mp4" },
        { name: "Máquina de Glúteos Horizontal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176289/maquinaGluteoHorizontal_izimqv.mp4" },
        { name: "Máquina de Glúteos Vertical", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176329/patadaGluteos_z1yqmi.mp4" },
        { name: "Máquina Hip Thrust Parado", isEnabled: true, videoUrl: "" },
        { name: "Multicadera para Glúteos", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176503/multicaderaGluteos_qqa3br.mp4" },
        { name: "Patada de Glúteos con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176567/gluteosPolea_cyykzc.mp4" },
        { name: "Patada de Glúteos Diagonal con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176619/patadaDiagonalPolea_net581.mp4" },
        { name: "Peso Muerto con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176674/pesoMuertoMancuerna_iuqlzu.mp4" },
        { name: "Peso Muerto en Landmine", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176725/pesoMuertoLandmine_ufrnhz.mp4" },
        { name: "Peso Muerto en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176814/pesoMuertoMaquina_xcu4ph.mp4" },
        { name: "Peso Muerto Rumano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176862/pesoMuerto_ygdigp.mp4" },
        { name: "Peso Muerto Rumano a una Pierna con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757176955/pesoMuertoRumanoAUnaPiernaEnDeficitConBarra_f3o3ds.mp4" },
        { name: "Peso Muerto Rumano a una Pierna con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177074/pesoMuertoRumanoConMancuernaAUnaPierna_h7phen.mp4" },
        { name: "Peso Muerto Rumano a una Pierna Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177116/pesoMuertoRumanoConMancuernaCruzadoAUnaPierna_nddvbt.mp4" },
        { name: "Peso Muerto Rumano con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177152/pesoMuertoRumanoMancuerna_qo0kv1.mp4" },
        { name: "Peso Muerto Sumo con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177238/sumoMuertoBarra_tymstt.mp4" },
        { name: "Puente de Glúteos con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177300/puenteGluteosBarra_y4quey.mp4" },
        { name: "Puente de Glúteos con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177345/puenteDeGluteosConMancuerna_z9t4va.mp4" },
        
        { name: "Salto al Cajón con Zancada", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177505/saltoAlCajonConZancadaAlternada_ktv7t1.mp4" }
    ],
    "Gemelos y Sóleos": [
        { name: "Elevación de Talones con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102559/elevacionTalonMancuerna_dbwuxc.mp4" },
        { name: "Gemelo a 45º con Apoyo Lumbar", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102561/gemelo45_xt0p7l.mp4" },
        { name: "Gemelo Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171340/maquinaCoser_vldayt.mp4" },
        { name: "Gemelos a 45º en Prensa", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102563/gemelos45Grados_wzvlif.mp4" },
        { name: "Máquina de Flexión Tibial", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171468/maquinaFlexionTibial_ycv2hy.mp4" },
        { name: "Máquina de Gemelo Parado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171618/maquinaBurritoGemelo_cxkst0.mp4" },
        { name: "Máquina de Gemelos", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102561/gemelos_xrfkdq.mp4" },
        { name: "Máquina de Gemelos Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171698/maquinaGemeloSentado_cflgnp.mp4" }
    ],
    "Aductores y Abductores": [
        { name: "Abductores en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102587/abductorExterno_sseks8.mp4" },
        { name: "Abductores en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102587/abductorPolea_fq1oxq.mp4" },
        { name: "Abductores Parado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102586/abductorParado_xs0hmj.mp4" },
        { name: "Aductores en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170910/sillaAductorAbduccion_qeodkn.mp4" },
        { name: "Multicadera para Abductor", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171080/multicaderaExterna_ylx6f3.mp4" },
        { name: "Multicadera para Aductor", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170991/multicaderaInterna_a9rsne.mp4" },
        { name: "Patada Lateral con Polea (Abductor)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757171174/gluteosPoleaLateral_ant9x7.mp4" }
    ],
    "Abdominales": [
        { name: "Abdominales en L", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102630/abdominalesEnL_qmu2yw.mp4" },
        { name: "Balanceo Hollow (Hollow Rock)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177959/hollowRockHold_bvm33f.mp4" },
        { name: "Bicicleta (Abdominales)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102644/bicicleta_gcq6qh.mp4" },
        { name: "Columpio Ruso", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757178313/arranqueConUnaMano_a45fkl.mp4" },
        { name: "Crunch 90 Grados", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757178381/crunch90_do6vzn.mp4" },
        { name: "Crunch Abdominal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102627/abdominalesConAnclajePies_ini5mx.mp4" },
        { name: "Doble Crunch", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757178476/tuckUp_c0hxzw.mp4" },
        { name: "Elevación de Piernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102645/elevacionDePiernas_satkvn.mp4" },
        { name: "Elevación de Piernas (Leg Raises)", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas con Giro", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102632/abdominalesTorre_xvapeg.mp4" },
        { name: "Elevación de Piernas en Posición Supina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102649/elevacionDePiernasEnPosicionSupina_anyxto.mp4" },
        { name: "Elevación de Rodillas en Banco Plano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102658/elevacionPiernasSujetoBanco_nndgvl.mp4" },
        { name: "Elevaciones con Peso", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102655/elevacionesConPeso_elchfy.mp4" },
        { name: "Encogimiento (Crunch)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193088/crunches_lrymxs.mp4" },
        { name: "Encogimiento en Banco Declinado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102652/elevacionesBanco_ikpx0h.mp4" },
        { name: "Encogimientos Oblicuos Cruzados", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193267/abdominalOblicuoCruzado_m9j5iz.mp4" },
        { name: "Encogimientos en Polea Alta", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193374/crunchPolea_iy1jig.mp4" },
        { name: "Escaladores (Mountain Climbers)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193515/mountainClimber_scl4hd.mp4" },
        { name: "Extensión de Espalda", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193800/lowerBack_f0ox8j.mp4" },
        { name: "Extensión de Piernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102660/extensionPiernasEnBanco_meetyl.mp4" },
        { name: "Giro Ruso (Russian Twist)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102666/giroRuso_lhtkcj.mp4" },
        { name: "Hollow Hold Flexionado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757194250/hollowRockHold_ik7aud.mp4" },
        { name: "In and Out (Adentro y Afuera)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757194687/inAndOut_qxyg9t.mp4" },
        { name: "Isométrico Hollow (Hollow Hold)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757177959/hollowRockHold_bvm33f.mp4" },
        { name: "Levantamiento de Torso (Sit-up)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195000/sitUp_k6ip9b.mp4" },
        { name: "Máquina de Crunch Abdominal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195152/crunchAbdominalEnGuia_f0dunt.mp4" },
        { name: "Máquina de Encogimiento Abdominal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195208/maquinaEncogimientoAbdominal_csvvqd.mp4" },
        { name: "Máquina de Espalda Baja", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757193800/lowerBack_f0ox8j.mp4" },
        { name: "Oblicuos en Colchoneta", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195366/oblicuos_r3eg6f.mp4" },
        { name: "Oblicuos en Suspensión", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195427/oblicuosSujetoBanco_iqbzrn.mp4" },
        { name: "Patada Mariposa", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195602/patadaMariposa_baorcu.mp4" },
        { name: "Patada Mariposa Extendida", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195646/patadaMariposaExtendido_vczsxu.mp4" },
        
        { name: "Pataleo (Flutter Kicks)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102665/flutterKick_ls0h1i.mp4" },
        { name: "Plancha (Plank)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757195876/plancha_sfniw6.mp4" },
        { name: "Plancha Almeja (Clamshell)", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Deslizamiento", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196109/planchaConDeslizamiento_oyxdh8.mp4" },
        { name: "Plancha con Elevación de Codo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196227/planchaElevacionCodo_hkbyal.mp4" },
        { name: "Plancha con Extensión de Codo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196396/planchaExtencionCodo_vustc4.mp4" },
        { name: "Plancha con Giro", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196618/plankRotation_jiswqu.mp4" },
        { name: "Plancha con Levantamiento", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Rotación de Caderas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196488/planchaRotacinCadera_xlobwq.mp4" },
        { name: "Plancha Lateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196729/planchaLateral_k6gucv.mp4" },
        { name: "Plancha Lateral con Rotación", isEnabled: true, videoUrl: "" },
        
        { name: "Rotación de Cintura en Landmine", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757196880/rotacionCinturaLandmine_pvq2uh.mp4" },
        { name: "Rotación de Torso en Máquina", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757197055/rotaryTorso_bobc4t.mp4" },
        { name: "Rotación de Torso Sujeción Superior", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757197134/rotaryTorsoSuperior_osetd0.mp4" },
        { name: "Rueda Abdominal", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102635/abdominalesConRueda_sep9d1.mp4" },
        
        { name: "Toque de Hombros en Plancha", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757197290/toquesDeHombro_yiwmpq.mp4" },
        { name: "Toque de Pies", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102630/abdominalesEnL_qmu2yw.mp4" },
        { name: "Toque de Talón", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757197454/toqueTalon_u1a7gc.mp4" },
        
        { name: "V-Up con Pierna Alternada", isEnabled: true, videoUrl: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Banco Scott con Disco", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102730/curlBiceps_wkqubh.mp4" },
        { name: "Bíceps con Barra y Banda", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102708/bicepsBarraBanda_js8bbd.mp4" },
        { name: "Curl 21", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102722/curl21_qi07cl.mp4" },
        { name: "Curl Alterno", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102734/curlBicepsAlternoMancuerna_ujj0rp.mp4" },
        { name: "Curl Alterno en Banca Inclinada", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102731/curlBicepsAlternoBancaInclinada_zbogfl.mp4" },
        { name: "Curl Concentrado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102713/bicepsMancuernasAjustable_p3c3mo.mp4" },
        { name: "Curl de Bíceps con Barra", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102770/curlBicepsBarra_crawkg.mp4" },
        { name: "Curl de Bíceps con Barra en Banco Scott", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102703/bicepsBarraApoyo_gqickw.mp4" },
        { name: "Curl de Bíceps con Barra Romana", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102711/bicepsBarraRomana_qaxgtd.mp4" },
        { name: "Curl de Bíceps con Barra Z", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102742/curlBicepsApoyoBarraZ_i1wpxv.mp4" },
        { name: "Curl de Bíceps con Mancuerna Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102734/curlBicepsAlternoMancuerna_ujj0rp.mp4" },
        { name: "Curl de Bíceps con Polea Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102717/bicepsPolea_vmctre.mp4" },
        { name: "Curl de Bíceps Concentrado Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102787/curlConcentradoMancuerna_e1qsnm.mp4" },
        { name: "Curl de Bíceps Convergente", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102781/curlBicepsConvergente_hxh3zo.mp4" },
        { name: "Curl de Bíceps en Banco Scott", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102698/bicepApoyo_jrzy54.mp4" },
        { name: "Curl de Bíceps en Máquina Scott", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173049/maquinaScott_sqtgsi.mp4" },
        { name: "Curl de Bíceps en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102782/curlBicepSoga_bfhpsi.mp4" },
        { name: "Curl de Bíceps en Polea Invertido", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102728/curlBicepPoleaInvertido_ycjqef.mp4" },
        { name: "Curl de Bíceps en Scott con Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102782/curlBicepScottPolea_mm0pzj.mp4" },
        { name: "Curl de Bíceps Sentado Alternado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173299/curlBicepsAlternadosentado_srs0vk.mp4" },
        { name: "Curl Martillo con Mancuerna", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102789/curlMartilloMancuerna_tdvsib.mp4" },
        { name: "Extensión de Codo en Polea Alta con Apoyo", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173441/poleaAltaParaTricep_qlwli7.mp4" },
        { name: "Extensión de Codo en Polea Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173523/tricepsIndividual_bbrkgb.mp4" },
        { name: "Extensión de Tríceps con Mancuernas", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102793/extensionDeTricepsConMancuerna_dj9q13.mp4" },
        { name: "Extensión de Tríceps en Polea Alta Unilateral", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173646/extensionAltaTricepsTrasnucaUnilateral_lvh8st.mp4" },
        { name: "Fondo en Banco", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102806/fondoBanco_n653j7.mp4" },
        { name: "Fondo en Paralelas (Dips)", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102803/fondo_qtxxxn.mp4" },
        { name: "Fondo de Tríceps Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102877/fondoTricepsSentado_mzzhod.mp4" },
        { name: "Jalón para Bíceps", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174436/jalonBiceps_negj0c.mp4" },
        { name: "Máquina de Extensión de Brazos", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102697/armExtension_q4lcon.mp4" },
        { name: "Máquina de Extensión de Tríceps", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173880/maquinaExtensionTriceps_arvjnb.mp4" },
        { name: "Máquina de Press Francés", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757173939/maquinaPressFrances_tnrzsg.mp4" },
        { name: "Patada de Tríceps en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174002/patadaTricepsPolea_r7djwl.mp4" },
        { name: "Press Francés", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174097/pressFrances_hvseeh.mp4" },
        { name: "Press Francés Sentado", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102797/extensionTricepsTrasnuca_cq9mng.mp4" },
        { name: "Press Francés Sentado a una Mano", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757102799/extensionTricepsUnaMano_ba3yqk.mp4" },
        { name: "Tríceps Trasnuca en Polea", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174344/tricepsPoleaSuperior_vxtiht.mp4" },
        { name: "Tríceps Trasnuca en Polea Baja", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757174291/tricepsTrasnucaPoleaBaja_bvbgus.mp4" }
    ],
    "Cardio y Cuerpo Completo": [
        { name: "Burpee", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757169919/burpee_bo60xv.mp4" },
        { name: "Burpee con Salto al Cajón", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170011/burpeeSaltoCajon_loipun.mp4" },
        { name: "Paso Lateral sobre Cajón", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170116/pasoLateralPorEncimaDeStep_c1psr5.mp4" },
        { name: "Salto al Cajón con Descenso", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170243/saltoAlCajonConDescensoControlado_cvkrsf.mp4" },
        { name: "Sprawl", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170320/sprawl_ctc21m.mp4" },
        { name: "Step-Up con Elevación de Rodilla", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170404/pasoRusoConMancuernaEnStep_z7njdo.mp4" },
        { name: "Step-Ups", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170464/stepUps_o2lzl9.mp4" },
        { name: "Subida al Cajón con Peso", isEnabled: true, videoUrl: "" },
        { name: "Walk Out", isEnabled: true, videoUrl: "https://res.cloudinary.com/dxztecjss/video/upload/v1757170640/walkOut_eycdg0.mp4" }
    ]
};

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("exerciselibrary");
  const { gymId } = req.query;

  if (!gymId) {
    return res.status(400).json({ message: 'Gym ID is required' });
  }

  switch (req.method) {
    case 'GET':
      try {
        let libraryDoc = await collection.findOne({ gymId: gymId });

        if (!libraryDoc) {
          console.log(`No exercise library found for gym ${gymId}, creating default one...`);
          const newLibrary = { gymId: gymId, data: DEFAULT_EXERCISE_LIBRARY };
          await collection.insertOne(newLibrary);
          libraryDoc = newLibrary;
        }
        
        res.status(200).json(libraryDoc.data);
      } catch (e) {
        console.error("API /api/library [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch exercise library' });
      }
      break;

    case 'POST':
      try {
        const libraryData = req.body;
        if (!libraryData) {
            return res.status(400).json({ message: 'Library data is required' });
        }
        
        await collection.updateOne(
          { gymId: gymId },
          { $set: { data: libraryData } },
          { upsert: true }
        );

        res.status(200).json({ success: true });
      } catch (e) {
        console.error("API /api/library [POST] Error:", e);
        res.status(500).json({ error: 'Unable to save exercise library' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}