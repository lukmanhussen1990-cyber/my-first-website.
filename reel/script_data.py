# Story script: Hinglish captions paired word-for-word with Devanagari for the TTS.
# Each entry: (hinglish, devanagari, [image numbers]).
# Word counts must match so every TTS word timestamp maps onto a caption word.

LINES = [
    ("Rajasthan ke ek gaon mein Seth Dhaniram rehta tha…",
     "राजस्थान के एक गाँव में सेठ धनीराम रहता था…", [1]),
    ("Gaon ka sabse ameer aadmi.",
     "गाँव का सबसे अमीर आदमी।", [2]),
    ("Uske paas itna sona tha ki tijoriyan bhar gayi thi.",
     "उसके पास इतना सोना था कि तिजोरियाँ भर गई थीं।", [3, 4]),
    ("Lekin wo itna kanjoos tha… ki naukaron ko bhi aadhi roti deta tha.",
     "लेकिन वो इतना कंजूस था… कि नौकरों को भी आधी रोटी देता था।", [5, 6]),
    ("Ghar wale sookhi daal khaate, aur Seth mithai ki rakhwali karta.",
     "घर वाले सूखी दाल खाते, और सेठ मिठाई की रखवाली करता।", [7]),
    ("Ek din ek bhookha bachcha uske darwaze pe aaya…",
     "एक दिन एक भूखा बच्चा उसके दरवाज़े पे आया…", [8]),
    ("Seth ne use dhakke maar ke bhaga diya.",
     "सेठ ने उसे धक्के मार के भगा दिया।", [9, 10]),
    ("Saamne khade ek sadhu ne sab dekha… aur sir hila diya.",
     "सामने खड़े एक साधु ने सब देखा… और सिर हिला दिया।", [11]),
    ("Seth ko har raat ek hi dar sataata tha…",
     "सेठ को हर रात एक ही डर सताता था…", [12]),
    ("\"Agar koi mera sona chura le toh?\"",
     "अगर कोई मेरा सोना चुरा ले तो?", [13]),
    ("Isliye usne haveli ke neeche ek gupt tehkhana banwaya…",
     "इसलिए उसने हवेली के नीचे एक गुप्त तहखाना बनवाया…", [14]),
    ("Jiska raasta sirf usse pata tha.",
     "जिसका रास्ता सिर्फ़ उसे पता था।", [15, 16]),
    ("Har raat wo neeche jaata, aur sone ke sikke ginta.",
     "हर रात वो नीचे जाता, और सोने के सिक्के गिनता।", [17, 18]),
    ("Ek raat ginte-ginte… dhadaam!",
     "एक रात गिनते-गिनते… धड़ाम!", [19]),
    ("Tehkhane ka bhaari darwaza band ho gaya.",
     "तहखाने का भारी दरवाज़ा बंद हो गया।", [20]),
    ("\"Bachao! Koi hai?\" Wo chillata raha…",
     "बचाओ! कोई है? वो चिल्लाता रहा…", [21]),
    ("Lekin upar kisi ko pata hi nahi tha… ki ye kamra exist karta hai.",
     "लेकिन ऊपर किसी को पता ही नहीं था… कि ये कमरा एग्ज़िस्ट करता है।", [22]),
    ("Ek din beeta… do din… pyaas se gala sookh gaya.",
     "एक दिन बीता… दो दिन… प्यास से गला सूख गया।", [23]),
    ("Chaaron taraf sona tha… lekin sona na khaaya ja sakta tha, na piya ja sakta tha.",
     "चारों तरफ़ सोना था… लेकिन सोना न खाया जा सकता था, न पिया जा सकता था।", [24]),
    ("Aakhri saanson mein usne deewar pe kuch likha…",
     "आख़िरी साँसों में उसने दीवार पे कुछ लिखा…", [25, 26]),
    ("Kai mahino baad, haveli ke naye maalik ko ek chhupa darwaza mila.",
     "कई महीनों बाद, हवेली के नए मालिक को एक छुपा दरवाज़ा मिला।", [27]),
    ("Andar sone ke dher ke beech… Seth ka kankaal pada tha.",
     "अंदर सोने के ढेर के बीच… सेठ का कंकाल पड़ा था।", [28]),
    ("Aur deewar pe likha tha… \"Duniya ka sabse ameer aadmi… bhookh se mar gaya.\"",
     "और दीवार पे लिखा था… दुनिया का सबसे अमीर आदमी… भूख से मर गया।", [29]),
    ("Dhan jodna galat nahi… lekin baantna bhool jaana, sabse badi gareebi hai.",
     "धन जोड़ना गलत नहीं… लेकिन बाँटना भूल जाना, सबसे बड़ी गरीबी है।", [30]),
]

# Where close-ups and pans aim, per image: (x, y) as fractions of width/height.
# First point = main subject (face/action) for close-ups, second = secondary detail.
FOCUS = {
    1: [(0.27, 0.18), (0.80, 0.80)],   # Seth on balcony / villagers
    2: [(0.45, 0.30), (0.55, 0.70)],   # proud face / gold necklace
    3: [(0.33, 0.30), (0.78, 0.48)],   # face / keys in the tijori
    4: [(0.55, 0.33), (0.62, 0.75)],   # grin / sack of gold
    5: [(0.28, 0.22), (0.82, 0.55)],   # Seth / servant with half roti
    6: [(0.58, 0.40), (0.40, 0.68)],   # servant's face / half roti
    7: [(0.75, 0.30), (0.20, 0.56)],   # Seth eating mithai / family with dry daal
    8: [(0.28, 0.33), (0.82, 0.50)],   # hungry boy / Seth's ringed hand
    9: [(0.62, 0.22), (0.22, 0.62)],   # angry Seth / boy falling
    10: [(0.42, 0.45), (0.86, 0.50)],  # crying boy / Seth in background
    11: [(0.33, 0.25), (0.80, 0.62)],  # sadhu / boy and Seth behind
    12: [(0.27, 0.62), (0.68, 0.25)],  # scared Seth / thief dream bubble
    13: [(0.38, 0.48), (0.80, 0.25)],  # terrified eyes / moonlit window
    14: [(0.73, 0.18), (0.30, 0.78)],  # Seth watching / labourers digging
    15: [(0.27, 0.40), (0.88, 0.75)],  # sneaky Seth / hidden stairs
    16: [(0.44, 0.20), (0.25, 0.32)],  # Seth on stairs / lantern
    17: [(0.52, 0.48), (0.80, 0.70)],  # counting coins / gold piles
    18: [(0.45, 0.33), (0.55, 0.70)],  # greedy grin / coins in hand
    19: [(0.56, 0.48), (0.22, 0.45)],  # door knocker / "THUD!"
    20: [(0.37, 0.30), (0.70, 0.68)],  # shocked face / flying coins
    21: [(0.47, 0.30), (0.73, 0.45)],  # screaming / fist on door
    22: [(0.25, 0.55), (0.80, 0.40)],  # sleeping guards / quiet palace
    23: [(0.27, 0.25), (0.27, 0.72)],  # parched face / dying lantern
    24: [(0.48, 0.40), (0.55, 0.55)],  # crying face / coin
    25: [(0.58, 0.37), (0.82, 0.25)],  # face / writing on the wall
    26: [(0.50, 0.55), (0.25, 0.80)],  # Seth in darkness / jewels
    27: [(0.52, 0.40), (0.78, 0.55)],  # hammer blow / revealed vault
    28: [(0.27, 0.25), (0.55, 0.30)],  # skull / wall writing
    29: [(0.53, 0.25), (0.10, 0.40)],  # horrified new owner / skeleton
    30: [(0.43, 0.30), (0.72, 0.50)],  # man sharing food / happy child
}

# For lines with two images: index of the word where the second image starts.
# Lines not listed are split automatically at the word nearest the midpoint.
IMAGE_SPLIT_WORD = {3: 5, 4: 5, 13: 5}

# The "dhadaam!" impact: (line number, word index) gets a hard cut + flash + shake.
IMPACT = (14, 3)

if __name__ == "__main__":
    for i, (hi_en, dev, imgs) in enumerate(LINES, 1):
        a, b = hi_en.split(), dev.split()
        status = "ok" if len(a) == len(b) else "MISMATCH"
        print(f"{i:2d} {status} {len(a)}/{len(b)} imgs={imgs}")
        if len(a) != len(b):
            print("   ", list(zip(a, b)))
