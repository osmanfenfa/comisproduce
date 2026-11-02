from sqlalchemy import Numeric

# All monetary amounts: exact decimal, 2 places. Never use Float for money.
Money = Numeric(14, 2)
