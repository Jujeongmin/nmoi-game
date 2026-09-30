/* Member lines for cv-talk.js — [ko, en, ja, zh-Hant, zh-Hans].
   Voices from the Jellyfish artist profile (신규 아티스트 프로필_VERSE8.pdf):
     yuon     leader · ESTJ · perfectionist, competitive · "이끌든지, 따르든지, 비키든지"
     natalie  dreamer · INFP · shy until close, empathetic, draws · "Always choose love"
     serin    visual · ESTJ · easygoing, cheeky, Gen-Z, "reads minds" · carpe diem
     tiya     sparkle · ENFP · happy virus, winks, hard work beats talent
     nara     maknae · ENFP · playful, dad jokes, fearless · "피하지 못하면 즐겨라"
   {nick} = the guest's nickname, {caviar} / {drink} = their order. Korean particles:
   {caviar|을/를} picks the first after a final consonant (받침), the second otherwise. Drafts: to be reviewed
   by the agency before launch. */
(function (NS) {
  'use strict';

  NS.talkLines = {
    yuon: {
      start:   ['{nick} 님, 시작할게요. 끝까지 같이 가요!', "{nick}, let's go. All the way to the end!", '{nick}さん、始めます。最後まで一緒に!', '{nick}，開始囉。一起撐到最後!', '{nick}，开始啦。一起坚持到最后!'],
      oops:    ['괜찮아요, 다음 거 제대로!', "It's fine. Nail the next one!", '大丈夫、次はきっちり!', '沒關係，下一個做好!', '没关系，下一个做好!'],
      good:    ['좋아요, 이 리듬 그대로!', 'Good. Keep this rhythm!', 'いいね、このリズムのまま!', '很好，保持這個節奏!', '很好，保持这个节奏!'],
      last10:  ['10초! 여기서 밀리면 안 돼요!', "10 seconds! Don't back down now!", '10秒! ここで引かないで!', '10 秒! 這時候不能退!', '10 秒! 这时候不能退!'],
      mission: ['미션 완료. 역시 {nick} 님이에요.', 'Mission done. That is so you, {nick}.', 'ミッション完了。さすが{nick}さん。', '任務完成。不愧是{nick}。', '任务完成。不愧是{nick}。'],
      best:    ['최고 기록! 이 기세면 1위도 가능해요.', 'New best! At this pace, first place is in reach.', '自己ベスト! この勢いなら1位も狙えます。', '最高紀錄! 照這氣勢第一名也有可能。', '最高纪录! 照这气势第一名也有可能。'],
      ok:      ['나쁘지 않아요. 근데 더 할 수 있잖아요?', "Not bad. But you can do more, right?", '悪くないです。でも、まだいけますよね?', '還不錯。但你還能更好吧?', '还不错。但你还能更好吧?'],
      low:     ['이끌든지, 따르든지! 다시 해봐요.', 'Lead or follow — just go again!', '率いるか、ついて来るか! もう一回。', '要嘛領頭，要嘛跟上! 再來一次。', '要么领头，要么跟上! 再来一次。'],
      again:   ['좋아요, 이번엔 제가 옆에서 볼게요.', "Good. I'll be watching right beside you.", 'よし、今度はそばで見てます。', '好，這次我在旁邊看著。', '好，这次我在旁边看着。'],
      bingo:   ['빙고판 정리해뒀어요. 확인해봐요.', 'I sorted out the bingo board for you. Take a look.', 'ビンゴ、整理しておきました。見てください。', '賓果盤幫你整理好了，看看吧。', '宾果盘帮你整理好了，看看吧。'],
      presave: ['프리세이브하면 매 판 x1.2예요. 전략이죠.', "Pre-save and every run is x1.2. That's strategy.", 'プリセーブで毎回x1.2。戦略です。', '預存後每局 x1.2，這是策略。', '预存后每局 x1.2，这是策略。'],
      caviar:  ['{caviar|을/를} 고르셨네요. 제대로 아시는 분이다.', 'You picked {caviar}. Someone who knows their stuff.', '{caviar}を選びましたね。分かってる人だ。', '你選了{caviar}，真是內行人。', '你选了{caviar}，真是内行人。'],
      drink:   ['{drink}까지, 완벽한 조합이에요.', 'And {drink} too. A perfect match.', '{drink}まで。完璧な組み合わせです。', '再加上{drink}，完美組合。', '再加上{drink}，完美组合。']
    },
    natalie: {
      start:   ['저… {nick} 님, 같이 해요.', 'Um… {nick}, let’s do this together.', 'あの…{nick}さん、一緒にやりましょう。', '那個…{nick}，一起來吧。', '那个…{nick}，一起来吧。'],
      oops:    ['앗… 괜찮아요, 천천히요.', "Oh… it's okay, take it slow.", 'あっ…大丈夫、ゆっくりで。', '啊…沒關係，慢慢來。', '啊…没关系，慢慢来。'],
      good:    ['와… 방금 너무 예뻤어요.', 'Wow… that was so pretty.', 'わぁ…今のすごくきれいでした。', '哇…剛剛好漂亮。', '哇…刚刚好漂亮。'],
      last10:  ['10초 남았어요… 응원할게요.', "Ten seconds left… I'm cheering for you.", 'あと10秒…応援してます。', '剩 10 秒了…我在幫你加油。', '剩 10 秒了…我在帮你加油。'],
      mission: ['미션 달성! 그림으로 남기고 싶어요.', 'Mission done! I want to draw this moment.', 'ミッション達成! 絵に残したいな。', '任務達成! 好想把這一刻畫下來。', '任务达成! 好想把这一刻画下来。'],
      best:    ['최고 기록이에요… 조금 감동했어요.', "Your best ever… I'm a little moved.", '自己ベストです…ちょっと感動しました。', '是最高紀錄…我有點感動。', '是最高纪录…我有点感动。'],
      ok:      ['수고했어요. 한 판 더… 할래요?', 'Well done. One more… maybe?', 'お疲れさま。もう1回…やります?', '辛苦了。再一局…好嗎?', '辛苦了。再一局…好吗?'],
      low:     ['괜찮아요. Always choose love, 알죠?', "It's okay. Always choose love, remember?", '大丈夫。Always choose love、ですよ。', '沒關係。Always choose love，記得嗎?', '没关系。Always choose love，记得吗?'],
      again:   ['네… 이번엔 더 잘될 거예요.', "Okay… it'll go better this time.", 'はい…今度はもっとうまくいきますよ。', '嗯…這次會更順利的。', '嗯…这次会更顺利的。'],
      bingo:   ['B컷… 제 것도 있어요. 부끄럽지만.', "There's a B-cut of me too… a bit embarrassing.", 'Bカット…わたしのもあります。恥ずかしいけど。', 'B-cut…也有我的，有點害羞。', 'B-cut…也有我的，有点害羞。'],
      presave: ['프리세이브… 해주면 정말 기쁠 거예요.', "A pre-save… would make me really happy.", 'プリセーブ…してくれたら本当にうれしいです。', '預存…的話我會超開心。', '预存…的话我会超开心。'],
      caviar:  ['{caviar}… 저도 좋아하는 거예요.', "{caviar}… that's one I love too.", '{caviar}…わたしも好きなんです。', '{caviar}…我也很喜歡。', '{caviar}…我也很喜欢。'],
      drink:   ['{drink|이랑/랑} 먹으면… 꿈꾸는 맛이에요.', 'With {drink}… it tastes like a dream.', '{drink}と一緒だと…夢みたいな味。', '配{drink}…像在做夢的味道。', '配{drink}…像在做梦的味道。']
    },
    serin: {
      start:   ['{nick} 님, 긴장했죠? 다 보여요~', "{nick}, nervous? I can tell~", '{nick}さん、緊張してる? 分かりますよ~', '{nick}，緊張了吧? 我都看出來了~', '{nick}，紧张了吧? 我都看出来了~'],
      oops:    ['오~ 방금 건 못 본 걸로 할게요.', "Ooh~ I'll pretend I didn't see that.", 'おっと~ 今のは見なかったことに。', '喔~ 剛剛那個我當沒看到。', '哦~ 刚刚那个我当没看到。'],
      good:    ['오 뭐야, 잘하는데요?', "Wait, you're actually good?", 'え、なに、上手じゃん?', '欸，很厲害耶?', '欸，很厉害嘛?'],
      last10:  ['10초! 지금 즐겨야 돼요, 카르페 디엠!', '10 seconds! Enjoy it — carpe diem!', '10秒! 今を楽しんで、カルペ・ディエム!', '10 秒! 享受當下，Carpe diem!', '10 秒! 享受当下，Carpe diem!'],
      mission: ['미션 클리어~ 이럴 줄 알았어요, 독심술로.', 'Mission clear~ I knew it. Mind reading.', 'ミッションクリア~ 読心術で分かってた。', '任務完成~ 我就知道，讀心術。', '任务完成~ 我就知道，读心术。'],
      best:    ['최고 기록? 인증샷 찍어줄게요.', "New best? Let me take your proof shot.", '自己ベスト? 記念写真撮ってあげる。', '最高紀錄? 我幫你拍張認證照。', '最高纪录? 我帮你拍张认证照。'],
      ok:      ['음~ 딱 한 판만 더 하면 될 것 같은데?', 'Hmm~ feels like just one more run would do it.', 'うーん、あと1回で行けそうじゃない?', '嗯~ 感覺再一局就行了?', '嗯~ 感觉再一局就行了?'],
      low:     ['괜찮아요~ 오늘을 즐겼으면 된 거예요.', "It's fine~ you enjoyed today, that's what counts.", '大丈夫~ 今日を楽しめたらそれでOK。', '沒事~ 享受今天就夠了。', '没事~ 享受今天就够了。'],
      again:   ['그쵸? 한 판 더 할 줄 알았어요.', 'Right? I knew you’d go again.', 'でしょ? もう1回やると思った。', '對吧? 我就知道你會再來。', '对吧? 我就知道你会再来。'],
      bingo:   ['빙고판 구경 가요, 맛집 찾듯이~', "Let's check the bingo board, like hunting for a good restaurant~", 'ビンゴ見に行こ、グルメ探しみたいに~', '去逛逛賓果盤，像找美食一樣~', '去逛逛宾果盘，像找美食一样~'],
      presave: ['프리세이브는 요즘 필수예요. 트렌드 몰라요?', "Pre-saving is a must now. Haven't you heard?", 'プリセーブは今や必須。トレンドですよ?', '預存是現在必備，不知道這個潮流嗎?', '预存是现在必备，不知道这个潮流吗?'],
      caviar:  ['{caviar}? 오, 취향 좀 아시네요.', '{caviar}? Ooh, you’ve got taste.', '{caviar}? おっ、センスいいですね。', '{caviar}? 喔，很有品味嘛。', '{caviar}? 哦，很有品味嘛。'],
      drink:   ['{drink}까지 고른 거 보니까, 맛잘알이네요.', 'Picking {drink} too — you really know food.', '{drink}まで選ぶなんて、グルメですね。', '連{drink}都選對，是懂吃的人。', '连{drink}都选对，是懂吃的人。']
    },
    tiya: {
      start:   ['{nick} 님, 파이팅! 오늘도 반짝반짝!', '{nick}, fighting! Let’s sparkle today!', '{nick}さん、ファイト! 今日もキラキラ!', '{nick}，加油! 今天也要閃閃發亮!', '{nick}，加油! 今天也要闪闪发亮!'],
      oops:    ['괜찮아요! 노력은 재능을 이긴다!', "It's okay! Hard work beats talent!", '大丈夫! 努力は才能に勝つ!', '沒關係! 努力會勝過天分!', '没关系! 努力会胜过天分!'],
      good:    ['우와아! 대박! 윙크 하나 드릴게요 ;)', "Wooow! Amazing! Here's a wink ;)", 'うわぁ! すごい! ウインクあげる ;)', '哇! 太強了! 送你一個 wink ;)', '哇! 太强了! 送你一个 wink ;)'],
      last10:  ['마지막 10초! 끝까지 최선을 다해요!', 'Last 10 seconds! Give it everything!', 'ラスト10秒! 最後まで全力で!', '最後 10 秒! 全力以赴!', '最后 10 秒! 全力以赴!'],
      mission: ['미션 성공! 해피 바이러스 발사~!', 'Mission success! Happy virus, go~!', 'ミッション成功! ハッピーウイルス発射~!', '任務成功! 快樂病毒發射~!', '任务成功! 快乐病毒发射~!'],
      best:    ['최고 기록이다! 우리 같이 춤춰요!', "It's your best! Let's dance together!", '自己ベストだ! 一緒に踊ろう!', '最高紀錄! 一起跳舞吧!', '最高纪录! 一起跳舞吧!'],
      ok:      ['좋았어요! 다음 판은 더 반짝일 거예요!', 'That was good! The next run will shine brighter!', 'よかった! 次はもっとキラキラするよ!', '很好! 下一局會更閃亮!', '很好! 下一局会更闪亮!'],
      low:     ['힘내요! 오늘을 최선을 다해 살자!', 'Cheer up! Let’s do our best today!', '元気出して! 今日を全力で生きよう!', '加油! 今天也要全力以赴!', '加油! 今天也要全力以赴!'],
      again:   ['좋아요! 이번엔 제가 제일 크게 응원할게요!', "Yes! I'll cheer the loudest this time!", 'よし! 今度は一番大きな声で応援する!', '好! 這次我最大聲幫你加油!', '好! 这次我最大声帮你加油!'],
      bingo:   ['빙고판에 반짝이는 칸 보러 가요!', "Let's go see the sparkly cells on the bingo board!", 'ビンゴのキラキラのマスを見に行こう!', '去看賓果盤上閃亮的格子吧!', '去看宾果盘上闪亮的格子吧!'],
      presave: ['프리세이브하면 저 진짜 춤출 거예요!', "Pre-save and I'll really dance!", 'プリセーブしてくれたら本当に踊っちゃう!', '預存的話我真的會跳舞!', '预存的话我真的会跳舞!'],
      caviar:  ['{caviar}! 반짝반짝 예쁘죠?', '{caviar}! Sparkly and pretty, right?', '{caviar}! キラキラしてきれいでしょ?', '{caviar}! 閃閃發亮很漂亮吧?', '{caviar}! 闪闪发亮很漂亮吧?'],
      drink:   ['{drink|이랑/랑} 같이! 오늘 기분 최고예요!', 'With {drink}! Best mood ever today!', '{drink}と一緒に! 今日は最高の気分!', '配{drink}! 今天心情超好!', '配{drink}! 今天心情超好!']
    },
    nara: {
      start:   ['{nick} 님! 피하지 못하면 즐기자!', "{nick}! If you can't avoid it, enjoy it!", '{nick}さん! 避けられないなら楽しもう!', '{nick}! 躲不掉就享受吧!', '{nick}! 躲不掉就享受吧!'],
      oops:    ['앗, 괜찮아요! 저도 맨날 덤벙대요!', "Oops, it's fine! I'm clumsy all the time too!", 'あっ、大丈夫! わたしもいつもドジるし!', '啊，沒事! 我也常常冒冒失失的!', '啊，没事! 我也常常冒冒失失的!'],
      good:    ['오예! 계단 네 칸씩 올라가는 느낌!', "Yes! Feels like taking the stairs four at a time!", 'やった! 階段4段飛ばしの気分!', '耶! 像一次跨四階樓梯的感覺!', '耶! 像一次跨四级楼梯的感觉!'],
      last10:  ['10초! 캐비어가 "캐비 어서!" 하는데요?', '10 seconds! The caviar says “hurry up!”', '10秒! キャビアが「早く!」って言ってる?', '10 秒! 魚子醬在說「快點!」', '10 秒! 鱼子酱在说「快点!」'],
      mission: ['미션 성공! 막내가 박수 쳐드릴게요!', 'Mission success! The maknae is clapping for you!', 'ミッション成功! 末っ子が拍手します!', '任務成功! 忙內幫你拍拍手!', '任务成功! 老幺帮你拍拍手!'],
      best:    ['최고 기록! 오늘 맛집 쏘셔야겠는데요?', "New best! Guess you're treating us today?", '自己ベスト! 今日はおごりですね?', '最高紀錄! 今天要請客了吧?', '最高纪录! 今天要请客了吧?'],
      ok:      ['재밌죠? 노는 게 제일 좋아~!', 'Fun, right? Playing is the best~!', '楽しいでしょ? 遊ぶのが一番~!', '好玩吧? 玩最棒了~!', '好玩吧? 玩最棒了~!'],
      low:     ['괜찮아요! 저는 지금 폰 어디 뒀는지 몰라요!', "It's okay! I don't even know where my phone is!", '大丈夫! わたしなんて今スマホどこか分からない!', '沒事! 我連手機放哪都不知道!', '没事! 我连手机放哪都不知道!'],
      again:   ['좋아요! 이번엔 겁 없이 가요!', "Yes! This time, fearless!", 'よし! 今度は怖いものなしで!', '好! 這次無所畏懼!', '好! 这次无所畏惧!'],
      bingo:   ['빙고 보러 가요! 빙고~ 빙고~', "Let's check the bingo! Bingo~ bingo~", 'ビンゴ見に行こう! ビンゴ~ ビンゴ~', '去看賓果! 賓果~ 賓果~', '去看宾果! 宾果~ 宾果~'],
      presave: ['프리세이브 해주면 막내가 애교 할게요!', "Pre-save and the maknae will do aegyo!", 'プリセーブしてくれたら末っ子が愛嬌します!', '預存的話忙內就撒嬌給你看!', '预存的话老幺就撒娇给你看!'],
      caviar:  ['{caviar}! 저 편식 안 해요, 다 좋아요!', "{caviar}! I'm not picky, I love them all!", '{caviar}! 好き嫌いないよ、全部好き!', '{caviar}! 我不挑食，都喜歡!', '{caviar}! 我不挑食，都喜欢!'],
      drink:   ['{drink}? 그럼 저는 막내라 물이요!', "{drink}? Then I'm the maknae, water for me!", '{drink}? じゃあ末っ子のわたしはお水で!', '{drink}? 那我是忙內，我喝水!', '{drink}? 那我是老幺，我喝水!']
    }
  };

  // The guest's replies on the result card.
  NS.talkReplies = {
    again:   ['한 판 더!', 'One more!', 'もう1回!', '再來一局!', '再来一局!'],
    bingo:   ['빙고 보여줘', 'Show me the bingo', 'ビンゴ見せて', '給我看賓果', '给我看宾果'],
    presave: ['부스터 받을래', "I'll take the booster", 'ブースターほしい', '我要加成', '我要加成'],
    next:    ['다음 ›', 'Next ›', '次へ ›', '下一句 ›', '下一句 ›']
  };
})(window.CAVIAR = window.CAVIAR || {});
