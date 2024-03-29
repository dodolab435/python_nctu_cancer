# 指定基礎映像
FROM python:3.9

# 設定工作目錄
WORKDIR /app

# 將Django專案複製到工作目錄
COPY . /app

# 安裝必要的套件
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

RUN python manage.py collectstatic --noinput
# 啟動Django伺服器
# CMD python manage.py runserver 0.0.0.0:8000
