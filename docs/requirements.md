# Task: Thiết kế tài liệu PRD chi tiết cho game dự đón world cup

## Yêu cầu thiết kế của game:

- Game dự đón dựa trên lịch thi đấu của các đội của fifa club wordcup 2026:
  - Dữ liều này được cần có cơ chế cho AI crawl từ internet, hoặc tích hợp các AI của các provider để lấy dữ liệu như: thông tin các đội bóng, các bảng đấu, lịch đấu chi tiết của các đội, dữ liệu cầu thủ của các đội
  - Dựa vào dữ liệu đó phải có 1 page để view được các thông tin này 1 cách chi tiết

- Game có nhiều mode chơi:
  - Mode chơi global:
    - Dây là mode dự đoán mà tất cả các user khi login vào hệ thống đều có thể dự đón với nhau
    - Với model chơi này cũng sẽ có 1 leaderboard để xếp hạng thứ hạng các người chơi dự vào điểm của người chơi
    - Với mode chơi global thì việc dự đón sẽ diễn ra trên toàn bộ tất cả các trận của giải đấu
    - Các cập đấu dự đoán có tỉ lệ nhân điểm phụ thuộc vào tỉ lệ từ các trang dự đón nổi tiếng được AI auto crawl và setup hoặc admin manual setup tỉ lệ này
  - Model chơi private:
    - User có thể tạo lobby private với việc setup mật khẩu, và có thể invite người chơi khác thông qua link invite hoặc nhập mật khẩu của lobby
    - Với model chơi private này cũng có leader board xếp hạng điểm của các người trong lobby đó
    - Với mode chơi private thì người chơi có thể chọn nhiều vòng khác nhau để tạo lobby chẳng hạn chỉ tạo lobby cho toàn bộ giải, cho vòng bảng, vòng 1/32, vòng tứ kết,... hoặc thậm chí chỉ tạo lobby cho 1 trận duy nhất
    - Các cập đấu dự đoán có tỉ lệ nhân điểm phụ thuộc vào tỉ lệ từ các trang dự đón nổi tiếng được AI auto crawl và setup hoặc chủ lobby manual setup tỉ lệ này
- Các nhận điểm và tích điểm:
  - Mode chơi global:
    - Tất cả các user lần đầu đăng ký đều được nhận 1000 point
    - Tất cả user đăng nhập điểm danh hằng ngày sẽ được nhận 200 point
    - Điểm này sẽ được đặt vào các lượt dự đón của các cập đấu, và dự váo kết quả của các cập đấu đó và tỉ lệ của các cập đấu, sẽ nhân với tỉ lệ nếu dự đoán đúng đội thắng sẽ có ra tổng point nhận về:
      - Ví dụ: cập đấu Pháp - Nhật bản, có tỉ lệ là 0.8 - 1.5, có nghĩ là nếu dự đoán pháp thắng 100 point và dự đoán đúng -> 100 + 100x0.8 = 180point nhận về, nếu dự đoán Nhật 100 point và dự đón đúng -> 100 + 100x1.5= 250point, còn dự đoán thua sẽ mất số point đó
    - Leaderboad sẽ xếp hạng dựa trên số điểm của user
  - Model chơi private:
    - User vào lobby sẽ nậnn được số point default được setup khi tạo phòng bởi chủ phòng
    - Với mode private sẽ có thể cơ chế mượn point, khi user hết điểm có thể request mượn point và đợi chủ phòng approval hoặc chủ phòng sẽ set point mượn trược tiếp cho người chơi trong lobby. Cách tính điểm đối với người mượn point, ví dụ người chơi có 100 point default từ lobby khi dự đoán thua hết 100point, khi đó user mượn 200pint thì tổng điểm user sẽ là -200 point -> cách tính điểm trong lobby sẽ là tổng điểm = tổng số point dự đoán thắng hiện có + point default - tổng số point mượn
    - Cách tính điểm dự đoán tương tự với mode global
- Các page chung khác dành cho user chẳng hạn như quản lí thông tin profile, point,...
- Ngoài các tính năng dành cho user, cũng cần các tính năng dành cho admin:
  - Quản lí user
  - Quản lí lobby -> việc quản lí lobby nhầm quan sát phát hiện các lobby có dấu hiệu lợi dụng point để cá cược, để khi đó có action trực tiếp tới lobby cũng như user đó chẳng hạn như banned, tố cáo tới cơ quan pháp luật
  - Quản lí thông tin các đội bóng, lịch thi đấu, tỉ lệ dự đoán của các cập cấp
  - Quản lí tin tức về giải đấu
- Ngoài ra cần có các trang tin tức bên lề về giải đấu worldcup để người chơi có thể theo dõi, các trang này sẽ được AI crawl và setup đăng 1 cách automatic
- Về cơ chết bảo mật:
  - Sử dụng các cơ chế bảo mật như dùng jwt cho auth hoặc cookie
  - Thu nhập ip user, user-agents để phục vụ cho việc xử lí nếu có sai phạm

## Yêu cầu tài liệu PRD:

- Tài liệu PRD phải chi tiết, có cấu trúc bộ cục 1 cách đầy đủ về các yêu cầu tính năng của game như:
  - User journey
  - Use case
  - Sequence diagram
  - Detail feature
- Ngoài ra nguyên cứu thêm về cấu trúc của 1 PRD chuẩn để update đúng nhất
- Tại liệu tổ chức tại: `/Users/taiphan/Documents/Projects/lab/wc-game/docs/prd`
