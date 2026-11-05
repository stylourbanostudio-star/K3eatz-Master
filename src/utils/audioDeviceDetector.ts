/**
 * K-3EATZ Professional Audio Device & Hardware Model Detector
 * Detects, categorizes, and inspects external & internal audio devices,
 * identifying manufacturers, exact models, bus interfaces, latency profiles,
 * and studio capabilities.
 */

export type AudioDeviceCategory = 
  | 'studio_interface'     // External Studio Interface (Focusrite, UA, MOTU, etc.)
  | 'usb_dac'              // USB DAC / Dedicated Headphone Amplifier
  | 'wireless_bluetooth'   // Wireless Bluetooth (AirPods, Sony WH, etc.)
  | 'studio_microphone'    // USB Studio Mic / Streaming Interface
  | 'hdmi_display'         // HDMI / DisplayPort Monitor Audio
  | 'virtual_cable'        // Virtual Loopback / Routing Cable
  | 'built_in'             // Motherboard / Laptop Built-in Speakers / Mic
  | 'analog_jack'          // 3.5mm P2/P3 Analog Headphone / Line-In
  | 'other';

export interface AudioDeviceInfoExtended {
  deviceId: string;
  groupId: string;
  kind: 'audiooutput' | 'audioinput';
  rawLabel: string;
  cleanLabel: string;
  manufacturer: string;
  model: string;
  category: AudioDeviceCategory;
  categoryLabel: string;
  isExternal: boolean;
  isProAudio: boolean;
  isDefault: boolean;
  busType: 'USB' | 'Thunderbolt' | 'Bluetooth' | 'PCIe' | 'HDMI/DP' | 'Virtual' | 'Internal' | 'Analog 3.5mm';
  sampleRates: string[];
  bitDepth: string;
  latencyEstimate: string;
  channelCount: number;
  features: string[];
  specsSummary: string;
  connectionStatus: 'connected' | 'active' | 'standby';
}

interface HardwareProfileRule {
  brand: string;
  category: AudioDeviceCategory;
  categoryLabel: string;
  busType: 'USB' | 'Thunderbolt' | 'Bluetooth' | 'PCIe' | 'HDMI/DP' | 'Virtual' | 'Internal' | 'Analog 3.5mm';
  isExternal: boolean;
  isProAudio: boolean;
  patterns: {
    regex: RegExp;
    model: string;
    features?: string[];
    sampleRates?: string[];
    bitDepth?: string;
    latency?: string;
  }[];
}

const HARDWARE_PROFILES: HardwareProfileRule[] = [
  // --- FOCUSRITE ---
  {
    brand: 'Focusrite',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio Externa (Studio)',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /scarlett\s*solo/i,
        model: 'Scarlett Solo (Gen 3/4)',
        features: ['Pré-amp Air Focusrite', 'Hi-Z Instrument Input', 'Direct Monitor Zero-Latency', 'Phantom Power +48V'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Delta-Sigma',
        latency: 'Ultra-Baixa (< 3.2 ms ASIO/CoreAudio)'
      },
      {
        regex: /scarlett\s*2i2/i,
        model: 'Scarlett 2i2 (Gen 3/4)',
        features: ['2x Pré-amps Air', 'Auto-Gain & Clip Safe', 'Direct Monitor Stereo', 'Dynamic Range 120 dB'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Converters',
        latency: 'Ultra-Baixa (< 2.8 ms ASIO/CoreAudio)'
      },
      {
        regex: /scarlett\s*4i4/i,
        model: 'Scarlett 4i4 (Multi-Track)',
        features: ['4 In / 4 Out', 'MIDI I/O Dedicado', 'Loopback Virtual', 'Stereo Monitor Pairs'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Converters',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /scarlett\s*18i20|18i8/i,
        model: 'Scarlett 18i20 Rackmount',
        features: ['8 Pré-amps Analógicos', 'ADAT Optical Expansível', 'DSP Mixer', 'Talkback Integrado'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit High-End Converters',
        latency: 'Ultra-Baixa (< 2.5 ms)'
      },
      {
        regex: /clarett/i,
        model: 'Clarett+ Pro Interface',
        features: ['Pré-amps Clarett All-Air', 'Conversão Reference-Grade', 'Thunderbolt/USB Ultra-Fast'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Reference D/A',
        latency: 'Latência Próxima a Zero (< 2.0 ms)'
      },
      {
        regex: /vocaster/i,
        model: 'Vocaster One / Two',
        features: ['Auto-Gain Voice Engine', 'Bluetooth Aux In', 'Direct Headphone Out'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit',
        latency: 'Ultra-Baixa'
      },
      {
        regex: /focusrite/i,
        model: 'Focusrite USB Audio Interface',
        features: ['Focusrite Precision Audio Bus', 'Low-Latency Direct Routing'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 3.5 ms)'
      }
    ]
  },

  // --- UNIVERSAL AUDIO ---
  {
    brand: 'Universal Audio',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio DSP / Mastering',
    busType: 'Thunderbolt',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /apollo\s*twin/i,
        model: 'Apollo Twin X (Duo/Quad)',
        features: ['Processamento DSP Realtime UAD-2', 'Pré-amps Unison', 'Conversão Elite-Class 127 dB', 'Talkback Mic'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Elite D/A',
        latency: 'Sub-milissegundo (< 1.1 ms DSP Tracking)'
      },
      {
        regex: /apollo\s*solo|arrow/i,
        model: 'Apollo Solo / Arrow',
        features: ['UAD-2 DSP Core', 'Pré-amp Unison', 'Bus Powered Thunderbolt/USB-C'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Sub-milissegundo (< 1.2 ms)'
      },
      {
        regex: /apollo\s*x(4|6|8|16)/i,
        model: 'Apollo X-Series Rack',
        features: ['HEXA Core DSP', 'Mastering Grade Monitoring', 'Surround 7.1 / Atmos Ready', '133 dB Dynamic Range'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit Elite Precision Converters',
        latency: 'Sub-milissegundo (< 0.9 ms)'
      },
      {
        regex: /volt\s*276|volt\s*476/i,
        model: 'Volt 276 / 476 Vintage Studio Interface',
        features: ['Compressor Analógico 76 Baseado no 1176', 'Vintage Mic Preamp Mode', 'Direct Monitoring Stereo'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /volt\s*1|volt\s*2/i,
        model: 'Volt 1 / 2 Studio Interface',
        features: ['Vintage Mic Preamp Mode', 'Conversão de Estúdio UA', 'Saída de Fone Dedicada Studio'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 3.2 ms)'
      },
      {
        regex: /universal\s*audio|apollo|volt/i,
        model: 'Universal Audio Apollo/Volt Interface',
        features: ['Conversão High-Fidelity UA', 'Zero-Latency Analog Routing'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 2.0 ms)'
      }
    ]
  },

  // --- MOTU (MARK OF THE UNICORN) ---
  {
    brand: 'MOTU',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio de Alta Precisão (DAC ESS)',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /motu\s*m2/i,
        model: 'MOTU M2 (ESS Sabre32 Ultra™ DAC)',
        features: ['Display LCD Full-Color Metering', 'ESS Sabre32 DAC 120 dB', 'Loopback Dedicado', 'Direct Monitor 1-touch'],
        sampleRates: ['44.1 kHz', '48 kHz', '88.2 kHz', '96 kHz', '176.4 kHz', '192 kHz'],
        bitDepth: '32-bit / 192 kHz Sabre DAC',
        latency: 'Ultra-Baixa (2.5 ms Round-Trip)'
      },
      {
        regex: /motu\s*m4/i,
        model: 'MOTU M4 (ESS Sabre32 Ultra™ DAC)',
        features: ['4 In / 4 Out balanceados', 'LCD Metering de Nível em Tempo Real', 'Monitor Mix Knob', 'Dual Loopback'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '32-bit / 192 kHz Sabre DAC',
        latency: 'Ultra-Baixa (2.5 ms Round-Trip)'
      },
      {
        regex: /ultralite|8pre|828|motu/i,
        model: 'MOTU Pro Studio Interface',
        features: ['DSP CuMix FX', 'Conversão ESS Sabre', 'Conexão USB-C / Thunderbolt'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 32-bit',
        latency: 'Ultra-Baixa (< 2.0 ms)'
      }
    ]
  },

  // --- SOLID STATE LOGIC (SSL) ---
  {
    brand: 'Solid State Logic',
    category: 'studio_interface',
    categoryLabel: 'Interface de Masterização Analógica SSL',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /ssl\s*2\+|ssl2\+/i,
        model: 'SSL 2+ Studio Interface',
        features: ['Modo Legacy 4K Analógico', '2x Saídas de Fone Independentes', 'MIDI I/O', 'Preamps SSL 62 dB Gain'],
        sampleRates: ['44.1 kHz', '48 kHz', '88.2 kHz', '96 kHz', '176.4 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz AKM Converters',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /ssl\s*2|ssl2/i,
        model: 'SSL 2 Studio Interface',
        features: ['Modo Legacy 4K Colour', 'Pré-amps de Estúdio SSL', 'Monitor Mix Balanceado'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /ssl\s*12|big\s*six/i,
        model: 'SSL 12 / BiG SiX Console Interface',
        features: ['Console Mixer Analógico', 'G-Series Bus Compressor', '4x Preamps SSL SuperAnalogue'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '32-bit / 192 kHz Reference',
        latency: 'Ultra-Baixa (< 2.0 ms)'
      }
    ]
  },

  // --- BEHRINGER / TC ELECTRONIC ---
  {
    brand: 'Behringer',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio Externa',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /umc204hd/i,
        model: 'U-Phoria UMC204HD',
        features: ['Pré-amps MIDAS com Phantom +48V', 'Insert Analógico para Hardware FX', 'Monitor A/B Switch'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Audiophile',
        latency: 'Baixa Latência (< 4.2 ms ASIO)'
      },
      {
        regex: /umc404hd/i,
        model: 'U-Phoria UMC404HD',
        features: ['4x Preamps MIDAS', '4x Inserts Analógicos', 'Saídas XLR + TRS Balanceadas'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Baixa Latência (< 4.2 ms)'
      },
      {
        regex: /umc202hd/i,
        model: 'U-Phoria UMC202HD',
        features: ['2x Preamps MIDAS', 'Direct Monitor Zero-Latency', 'Phantom Power +48V'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Baixa Latência (< 4.5 ms)'
      },
      {
        regex: /umc22|um2/i,
        model: 'U-Phoria UM2 / UMC22',
        features: ['Xenyx Mic Preamp', 'Instrument In', 'Direct Monitor'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '16-bit / 48 kHz',
        latency: 'Média (~ 7 ms)'
      },
      {
        regex: /goxlr/i,
        model: 'TC-Helicon GoXLR Broadcast Interface',
        features: ['Mixer Motorizado 4 Canais', 'Vocal FX DSP', 'Midas Preamp +72 dB'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit',
        latency: 'Ultra-Baixa'
      }
    ]
  },

  // --- PRESONUS ---
  {
    brand: 'PreSonus',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio Studio',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /audiobox\s*(usb|96|itwo)?/i,
        model: 'AudioBox USB 96',
        features: ['Pré-amps Classe A', 'Chassi Metálico Resistente', 'MIDI I/O', 'Mixer Knob'],
        sampleRates: ['44.1 kHz', '48 kHz', '88.2 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz',
        latency: 'Baixa Latência (< 4.5 ms)'
      },
      {
        regex: /studio\s*(24c|26c|68c|1824c)/i,
        model: 'PreSonus Studio Series USB-C',
        features: ['Pré-amps XMAX Classe A', 'Medidores de Nível em Escada LED', 'USB-C Bus Powered'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Converters',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /quantum/i,
        model: 'PreSonus Quantum Thunderbolt/USB Interface',
        features: ['Latência Próxima a Zero', 'Thunderbolt Direct Bus', 'Conversão Master Class'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Menor que 1.0 ms'
      }
    ]
  },

  // --- AUDIENT / EVO ---
  {
    brand: 'Audient',
    category: 'studio_interface',
    categoryLabel: 'Interface Console Preamp Audient',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /id4|id14|id22|id44/i,
        model: 'Audient iD Series (Console Preamp)',
        features: ['Audient Console Mic Preamp', 'JFET D.I. Instrument Input', 'ScrollControl Virtual Encoder'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz Class Leading',
        latency: 'Ultra-Baixa (< 3.2 ms)'
      },
      {
        regex: /evo\s*(4|8|16)/i,
        model: 'Audient EVO Smart Interface',
        features: ['Smartgain Automático', 'Audio Loopback Integrado', 'Preamps Transparentes EVO'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz',
        latency: 'Ultra-Baixa (< 3.5 ms)'
      }
    ]
  },

  // --- RODE ---
  {
    brand: 'Rode',
    category: 'studio_interface',
    categoryLabel: 'Interface / Mixer de Produção e Voz',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /rodecaster\s*(pro|duo)?/i,
        model: 'RodeCaster Pro Audio Production Studio',
        features: ['Revolution Preamps™ Ultra-Quiet', 'DSP APHEX® Integrado', 'Dual USB-C Interface', 'Bluetooth I/O'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit / 48 kHz',
        latency: 'Ultra-Baixa DSP'
      },
      {
        regex: /ai-1|ai1/i,
        model: 'Rode AI-1 USB Interface',
        features: ['Neutrik Combo Jack', 'Discrete Class-A Preamp', 'High-Power Headphone Amp'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz',
        latency: 'Ultra-Baixa'
      },
      {
        regex: /nt-usb|podmic|wireless\s*go/i,
        model: 'Rode USB Studio Microphone / Wireless',
        features: ['Cápsula Condensadora Studio', 'Zero-Latency Headphone Monitoring'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit',
        latency: 'Baixa'
      }
    ]
  },

  // --- YAMAHA / STEINBERG ---
  {
    brand: 'Yamaha / Steinberg',
    category: 'studio_interface',
    categoryLabel: 'Interface de Áudio D-PRE',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /ur22c|ur44c|ur12|ur24c/i,
        model: 'Steinberg UR-C Series (32-bit/192kHz)',
        features: ['Pré-amps Yamaha D-PRE Classe A', 'DSP SSP3 Integrado (REV-X)', 'USB 3.1 Type-C Gen 1'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '32-bit Integer / 192 kHz',
        latency: 'Ultra-Baixa (< 3.0 ms)'
      },
      {
        regex: /ag03|ag06|ag08/i,
        model: 'Yamaha AG Series Mixer / Interface',
        features: ['Mixer Fader Físico', 'Compressor/EQ 1-Touch DSP', 'Modo Loopback para Streaming'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa'
      }
    ]
  },

  // --- ARTURIA ---
  {
    brand: 'Arturia',
    category: 'studio_interface',
    categoryLabel: 'Interface de Estúdio e Produção',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /minifuse\s*(1|2|4)?/i,
        model: 'Arturia MiniFuse Series',
        features: ['Relação Sinal-Ruído 110 dB', 'Hub USB Integrado', 'Direct Monitoring com Vu-Meter RGB'],
        sampleRates: ['44.1 kHz', '48 kHz', '88.2 kHz', '96 kHz', '176.4 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Ultra-Baixa (< 3.1 ms)'
      },
      {
        regex: /audiofuse/i,
        model: 'Arturia AudioFuse Studio',
        features: ['Preamps DiscretePRO®', 'Chave A/B Monitor Reference', 'Talkback Integrado', 'Conversão Pro'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz Pure Sound',
        latency: 'Ultra-Baixa (< 2.2 ms)'
      }
    ]
  },

  // --- RME ---
  {
    brand: 'RME Audio',
    category: 'studio_interface',
    categoryLabel: 'Interface de Masterização Reference-Grade',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /babyface|fireface|adi-2/i,
        model: 'RME Reference Audio Interface (SteadyClock FS)',
        features: ['SteadyClock FS Jitter Immunity', 'TotalMix FX DSP Matrix', 'Estabilidade Máxima de Driver'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz', '768 kHz'],
        bitDepth: '32-bit / 768 kHz Reference',
        latency: 'Zero Jitter / Menor que 1.5 ms'
      }
    ]
  },

  // --- SHURE ---
  {
    brand: 'Shure',
    category: 'studio_microphone',
    categoryLabel: 'Microfone Studio USB / Interface',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /mv7|mv88|motiv/i,
        model: 'Shure MV7 / MOTIV Podcast & Studio Mic',
        features: ['Cápsula Dinâmica Shure', 'DSP Voice Isolation', 'Auto-Level Mode', 'Saída de Fone Dedicada'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit',
        latency: 'Zero Latência Direta'
      }
    ]
  },

  // --- AUDIO-TECHNICA / BLUE / ELGATO ---
  {
    brand: 'Blue / Logitech',
    category: 'studio_microphone',
    categoryLabel: 'Microfone Studio USB Condensador',
    busType: 'USB',
    isExternal: true,
    isProAudio: false,
    patterns: [
      {
        regex: /yeti|snowball/i,
        model: 'Blue Yeti / Snowball Studio USB Mic',
        features: ['Cápsula Tri-Condensadora', 'Padrões Múltiplos (Cardióide, Omni, Bi, Estéreo)', 'Fone com Controle de Volume'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '16-bit / 24-bit',
        latency: 'Monitoramento Direto em Tempo Real'
      }
    ]
  },
  {
    brand: 'Elgato',
    category: 'studio_microphone',
    categoryLabel: 'Microfone Broadcast USB / Interface XLR',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /wave\s*(1|3|xlr)?/i,
        model: 'Elgato Wave Studio Series',
        features: ['Clipguard Antidistorção', 'Conversão 24-bit/96kHz', 'Wave Link Digital Mixer'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz',
        latency: 'Zero Latência'
      }
    ]
  },

  // --- AUDIOPHILE DACS (FiiO, Schiit, Topping, iFi) ---
  {
    brand: 'FiiO / Schiit / iFi Audio',
    category: 'usb_dac',
    categoryLabel: 'DAC USB Audiophile & Amplificador de Fone',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /fiio|k5|k7|k9|btr/i,
        model: 'FiiO High-Resolution Audio DAC / Amp',
        features: ['Chipset AKM / ESS Sabre', 'DSD Nativo / MQA Decoder', 'Saída Balanceada 4.4mm / XLR'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz', '384 kHz', '768 kHz'],
        bitDepth: '32-bit / DSD512',
        latency: 'Modo Bit-Perfect Assíncrono'
      },
      {
        regex: /schiit|modi|magni|hel|fulla/i,
        model: 'Schiit Audio DAC / Headphone Amp',
        features: ['Arquitetura Multibit Unison USB™', 'Amplificação Discreta High-Current', 'Zero Compressão Digital'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '24-bit / 192 kHz',
        latency: 'Bit-Perfect Low Latency'
      },
      {
        regex: /ifi|zen\s*dac|hip-dac|go\s*blu/i,
        model: 'iFi Zen DAC / Mobile DAC',
        features: ['Burr-Brown True Native DSD/DXD', 'PowerMatch & TrueBass Analógico', 'Relógio GMT Femto-Precision'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz', '384 kHz'],
        bitDepth: '32-bit / DSD256',
        latency: 'Ultra-Low Jitter'
      },
      {
        regex: /topping|dx3|e30|l30/i,
        model: 'Topping Hi-Fi DAC / Amp',
        features: ['XMOS XU208 USB', 'THD+N < 0.0001%', 'Certificação Hi-Res Audio'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz', '384 kHz'],
        bitDepth: '32-bit / 768 kHz',
        latency: 'Asynchronous Audio Stream'
      }
    ]
  },

  // --- APPLE HEADPHONES & DEVICES ---
  {
    brand: 'Apple',
    category: 'wireless_bluetooth',
    categoryLabel: 'Fone Sem Fio Bluetooth / Spatial Audio',
    busType: 'Bluetooth',
    isExternal: true,
    isProAudio: false,
    patterns: [
      {
        regex: /airpods\s*max/i,
        model: 'AirPods Max (Spatial Audio)',
        features: ['Áudio Espacial com Rastreamento Dinâmico', 'Cancelamento Ativo de Ruído (ANC)', 'Modo Ambiente Adaptativo'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: 'AAC / 24-bit Processing',
        latency: 'Bluetooth AAC (~ 100-140 ms)'
      },
      {
        regex: /airpods\s*pro/i,
        model: 'AirPods Pro (ANC & Transparência)',
        features: ['EQ Adaptativo', 'Drivers Apple Custom-Excursion', 'Modo Conversa'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: 'AAC Stereo',
        latency: 'Bluetooth Low-Latency (~ 110 ms)'
      },
      {
        regex: /airpods/i,
        model: 'Apple AirPods Wireless',
        features: ['Chip H1/H2 Apple', 'Troca Automática de Dispositivo'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: 'AAC',
        latency: 'Bluetooth (~ 120 ms)'
      },
      {
        regex: /macbook.*(speaker|auto-falante|alto-falante)/i,
        model: 'MacBook Pro Built-in Studio Speakers',
        features: ['Sistema de 6 Alto-falantes com Woofers Force-Cancelling', 'Suporte a Áudio Espacial Dolby Atmos'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz CoreAudio',
        latency: 'Ultra-Baixa Interna (< 2.5 ms)'
      },
      {
        regex: /macbook.*(microfone|mic)/i,
        model: 'MacBook Pro 3-Mic Studio Array',
        features: ['Conjunto de 3 Microfones com Qualidade de Estúdio', 'Alta Relação Sinal-Ruído', 'Formação Direcional de Feixe'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit',
        latency: 'Interna'
      }
    ]
  },

  // --- SONY WIRELESS / REFERENCE ---
  {
    brand: 'Sony',
    category: 'wireless_bluetooth',
    categoryLabel: 'Fone Sem Fio Bluetooth Hi-Res LDAC',
    busType: 'Bluetooth',
    isExternal: true,
    isProAudio: false,
    patterns: [
      {
        regex: /wh-1000xm(4|5|3)|wf-1000xm(4|5)/i,
        model: 'Sony WH-1000XM Series (LDAC / Hi-Res Wireless)',
        features: ['Codec LDAC 990 kbps Suportado', 'Processador de Ruído HD QN1', 'DSEE Extreme™'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 96 kHz (LDAC)',
        latency: 'Bluetooth (~ 100-150 ms)'
      },
      {
        regex: /sony/i,
        model: 'Sony Wireless Audio Device',
        features: ['Bluetooth Audio Stream', 'Som Estéreo Balanceado'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '16-bit / 24-bit',
        latency: 'Bluetooth (~ 120 ms)'
      }
    ]
  },

  // --- VIRTUAL ROUTING (BlackHole, Loopback, Voicemeeter) ---
  {
    brand: 'Virtual Audio Driver',
    category: 'virtual_cable',
    categoryLabel: 'Cabo de Roteamento Virtual / Loopback',
    busType: 'Virtual',
    isExternal: false,
    isProAudio: true,
    patterns: [
      {
        regex: /blackhole\s*2ch/i,
        model: 'BlackHole 2-Channel Virtual Driver',
        features: ['Zero Latency Virtual Passthrough', 'Direct DAW to Mastering Pipeline', 'Lossless 32-bit Float Bus'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '32-bit Float',
        latency: 'Zero Latência Digital (0 ms)'
      },
      {
        regex: /blackhole\s*(16ch|64ch)?/i,
        model: 'BlackHole Multi-Channel Virtual Matrix',
        features: ['Multi-Channel Routing', 'Até 64 Canais Virtuais', 'Lossless Pipeline'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '32-bit Float',
        latency: 'Zero Latência Digital (0 ms)'
      },
      {
        regex: /loopback/i,
        model: 'Rogue Amoeba Loopback Virtual Interface',
        features: ['Matriz de Roteamento Profissional Mac', 'Agrupamento de Múltiplos Softwares'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '32-bit Float',
        latency: 'Zero Latência Digital'
      },
      {
        regex: /voicemeeter/i,
        model: 'VB-Audio Voicemeeter Virtual Mixer',
        features: ['Console Virtual de Mixagem', 'Canais Auxiliares VAIO', 'ASIO Insert Driver'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '24-bit / 32-bit',
        latency: 'Baixa Latência Virtual'
      },
      {
        regex: /soundflower|vb-audio|virtual\s*audio/i,
        model: 'Virtual Audio Loopback Cable',
        features: ['Roteamento Interno entre Aplicativos', 'Sem Degradação de Áudio'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '24-bit / 32-bit',
        latency: 'Digital Direto'
      }
    ]
  },

  // --- HDMI / DISPLAY MONITOR ---
  {
    brand: 'Display / HDMI',
    category: 'hdmi_display',
    categoryLabel: 'Áudio Digital HDMI / DisplayPort',
    busType: 'HDMI/DP',
    isExternal: true,
    isProAudio: false,
    patterns: [
      {
        regex: /hdmi|displayport|lg|dell|samsung|asus|benq|tv|monitor/i,
        model: 'Monitor / TV Digital Audio Link',
        features: ['Transmissão Digital via Cabo de Vídeo', 'DAC Integrado ao Display'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '16-bit / 24-bit LPCM',
        latency: 'Latência do Monitor (~ 20-40 ms)'
      }
    ]
  },

  // --- GENERIC USB AUDIO CODEC ---
  {
    brand: 'Generic Pro Audio',
    category: 'studio_interface',
    categoryLabel: 'Interface / DAC USB Externa (Plug & Play)',
    busType: 'USB',
    isExternal: true,
    isProAudio: true,
    patterns: [
      {
        regex: /usb\s*audio\s*codec|usb\s*pnp|usb\s*audio\s*device/i,
        model: 'USB Audio Codec (External Interface)',
        features: ['Controlador USB Class Compliant', 'Conversão A/D e D/A Estéreo Direta', 'Compatibilidade Universal'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz'],
        bitDepth: '16-bit / 24-bit',
        latency: 'Baixa Latência USB (~ 5-8 ms)'
      }
    ]
  },

  // --- INTERNAL / REALTEK / INTEL ---
  {
    brand: 'Motherboard / Internal',
    category: 'built_in',
    categoryLabel: 'Áudio Integrado do Sistema (Placa-mãe)',
    busType: 'Internal',
    isExternal: false,
    isProAudio: false,
    patterns: [
      {
        regex: /realtek/i,
        model: 'Realtek High Definition Audio (Onboard)',
        features: ['Codec Onboard HD Audio', 'Saída de Fone / Alto-Falante Padrão'],
        sampleRates: ['44.1 kHz', '48 kHz', '96 kHz', '192 kHz'],
        bitDepth: '16-bit / 24-bit',
        latency: 'Latência Padrão do Sistema (~ 15-25 ms DirectSound)'
      },
      {
        regex: /intel\s*smart\s*sound|intel\s*sst|conexant|cirrus/i,
        model: 'Intel / Conexant Internal Audio Controller',
        features: ['Controlador de Áudio da Placa-mãe', 'Saída e Entrada Integradas'],
        sampleRates: ['44.1 kHz', '48 kHz'],
        bitDepth: '16-bit / 24-bit',
        latency: 'Padrão'
      }
    ]
  }
];

/**
 * Parses a media device's raw label and identifier, matching against pro audio profiles
 */
export function identifyAudioHardware(device: MediaDeviceInfo): AudioDeviceInfoExtended {
  const raw = device.label || '';
  const id = device.deviceId;
  const isDefault = id === 'default' || raw.toLowerCase().startsWith('default') || raw.toLowerCase().startsWith('padrão');

  // Clean the label by stripping prefixes and trailing device IDs
  let cleaned = raw
    .replace(/^(default|padrão|communications|comunicação)\s*-\s*/i, '')
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, '')
    .trim();

  if (!cleaned) {
    if (isDefault) {
      cleaned = device.kind === 'audiooutput' 
        ? 'Alto-falantes do Sistema (Padrão)' 
        : 'Microfone do Sistema (Padrão)';
    } else {
      cleaned = device.kind === 'audiooutput'
        ? `Saída de Áudio (${id.substring(0, 5)})`
        : `Entrada de Áudio (${id.substring(0, 5)})`;
    }
  }

  const lower = (raw + ' ' + cleaned).toLowerCase();

  // Test against database rules
  for (const profile of HARDWARE_PROFILES) {
    for (const pat of profile.patterns) {
      if (pat.regex.test(lower)) {
        return {
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: (device.kind === 'audioinput' ? 'audioinput' : 'audiooutput') as 'audiooutput' | 'audioinput',
          rawLabel: raw,
          cleanLabel: cleaned,
          manufacturer: profile.brand,
          model: pat.model,
          category: profile.category,
          categoryLabel: profile.categoryLabel,
          isExternal: profile.isExternal,
          isProAudio: profile.isProAudio,
          isDefault: isDefault,
          busType: profile.busType,
          sampleRates: pat.sampleRates || ['44.1 kHz', '48 kHz', '96 kHz'],
          bitDepth: pat.bitDepth || '24-bit',
          latencyEstimate: pat.latency || 'Ultra-Baixa Latência',
          channelCount: 2,
          features: pat.features || ['Roteamento Direto', 'Monitoramento Estéreo'],
          specsSummary: `${profile.brand} • ${pat.model} (${profile.busType})`,
          connectionStatus: isDefault ? 'active' : 'connected'
        };
      }
    }
  }

  // Fallback heuristics if no specific brand rule matched
  const isUsb = /usb/i.test(lower);
  const isBluetooth = /bluetooth|bt|airpods|buds|wireless|fone de ouvido bluetooth/i.test(lower);
  const isHdmi = /hdmi|displayport|dp|digital/i.test(lower);
  const isHeadphones = /headphone|fone|headset|earphone/i.test(lower);
  const isExternalGuess = isUsb || isBluetooth || isHdmi;

  let fallbackCategory: AudioDeviceCategory = 'built_in';
  let categoryLabel = 'Dispositivo de Áudio do Sistema';
  let busType: AudioDeviceInfoExtended['busType'] = 'Internal';

  if (isUsb) {
    fallbackCategory = 'studio_interface';
    categoryLabel = 'Dispositivo de Áudio USB Externo';
    busType = 'USB';
  } else if (isBluetooth) {
    fallbackCategory = 'wireless_bluetooth';
    categoryLabel = 'Fone / Receptor Bluetooth';
    busType = 'Bluetooth';
  } else if (isHdmi) {
    fallbackCategory = 'hdmi_display';
    categoryLabel = 'Saída de Vídeo / HDMI';
    busType = 'HDMI/DP';
  } else if (isHeadphones) {
    fallbackCategory = 'analog_jack';
    categoryLabel = 'Saída Analógica de Fones (3.5mm)';
    busType = 'Analog 3.5mm';
  }

  return {
    deviceId: device.deviceId,
    groupId: device.groupId,
    kind: (device.kind === 'audioinput' ? 'audioinput' : 'audiooutput') as 'audiooutput' | 'audioinput',
    rawLabel: raw,
    cleanLabel: cleaned,
    manufacturer: isExternalGuess ? (isUsb ? 'Interface USB Externa' : isBluetooth ? 'Bluetooth Audio' : 'External Audio') : 'Sistema Operacional',
    model: cleaned || (isExternalGuess ? 'Dispositivo Externo Conectado' : 'Áudio Integrado'),
    category: fallbackCategory,
    categoryLabel: categoryLabel,
    isExternal: isExternalGuess,
    isProAudio: isUsb,
    isDefault: isDefault,
    busType: busType,
    sampleRates: ['44.1 kHz', '48 kHz'],
    bitDepth: '24-bit',
    latencyEstimate: isUsb ? 'Baixa Latência USB (~ 5 ms)' : isBluetooth ? 'Bluetooth (~ 120 ms)' : 'Padrão (~ 15 ms)',
    channelCount: 2,
    features: ['Roteamento Direto', 'Conversão PCM Estéreo'],
    specsSummary: `${cleaned} (${busType})`,
    connectionStatus: isDefault ? 'active' : 'connected'
  };
}

/**
 * Pre-configured reference studio interfaces for testing or simulation
 */
export const POPULAR_STUDIO_INTERFACES: { brand: string; model: string; bus: string; category: string; description: string }[] = [
  {
    brand: 'Focusrite',
    model: 'Scarlett 2i2 (4th Gen)',
    bus: 'USB-C',
    category: 'Interface de Estúdio Mais Popular',
    description: 'Preamps Air com Auto-Gain, 120dB de faixa dinâmica e conversores RedNet.'
  },
  {
    brand: 'Universal Audio',
    model: 'Apollo Twin X USB / Thunderbolt',
    bus: 'Thunderbolt / USB-C',
    category: 'Referência de Masterização & DSP',
    description: 'Processamento UAD-2 em tempo real, conversores Elite-Class e pré-amps Unison.'
  },
  {
    brand: 'MOTU',
    model: 'MOTU M2 / M4',
    bus: 'USB-C',
    category: 'Referência DAC ESS Sabre32',
    description: 'Display LCD color com medidores de nível ópticos e latência de 2.5ms.'
  },
  {
    brand: 'Solid State Logic',
    model: 'SSL 2+',
    bus: 'USB-C',
    category: 'Cor Analógica SSL 4K',
    description: 'Preamps lendários SSL com botão analógico Legacy 4K e duas saídas de fone.'
  },
  {
    brand: 'Behringer',
    model: 'U-Phoria UMC204HD / 404HD',
    bus: 'USB',
    category: 'Custo-benefício Profissional',
    description: 'Preamps desenhados pela MIDAS com inserts analógicos para compressores de hardware.'
  }
];
