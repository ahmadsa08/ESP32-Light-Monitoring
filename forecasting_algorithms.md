# 3. Forecasting Algorithm Selection

This project uses two time-series forecasting methods: **Exponential Moving Average (EMA)** and **Holt-Winters (Holt's Linear Smoothing)**. These methods were selected because they are both **accurate** and **efficient** for handling real-time sensor data.

## 3.1 Exponential Moving Average (EMA)

### Explanation:
EMA is a forecasting technique that gives more weight to recent data points, making it sensitive to short-term changes while smoothing out random noise.

### Formula:

\[
EMA_t = \alpha \times \text{Value}_t + (1 - \alpha) \times EMA_{t-1}
\]

- **Value_t**: Current sensor reading
- **EMA_{t-1}**: Previous EMA value
- **\(\alpha\)**: Smoothing factor (between 0 and 1); determines how much weight is given to recent data

In this project, **\(\alpha = 0.1\)**, which results in a smoother trend line with moderate responsiveness.

### Key Advantages:
- Simple and fast to compute.
- Effective in detecting sudden changes.
- Ideal for resource-limited environments.

## 3.2 Holt-Winters (Holt's Linear Exponential Smoothing)

### Explanation:
Holt-Winters is a time-series forecasting method that extends exponential smoothing to handle data with a trend. Since the sensor data may exhibit a trend (i.e., a general upward or downward direction), **Holt's Linear Exponential Smoothing** is used. This method tracks both the level (the smoothed value of the series) and the trend (the rate of change of the series).

### Formulas:

- **Level**:

\[
L_t = \alpha \times \text{Value}_t + (1 - \alpha) \times (L_{t-1} + T_{t-1})
\]

- **Trend**:

\[
T_t = \beta \times (L_t - L_{t-1}) + (1 - \beta) \times T_{t-1}
\]

- **Forecast**:

\[
\text{Forecast}_{t+h} = L_t + h \times T_t
\]

### Key Advantages:
- Detects and models underlying trends in the data.
- More accurate than EMA when long-term patterns exist.
- Useful for forecasting environmental changes over time.

## 3.3 Justification for Choice of Algorithms

| **Algorithm**           | **Reason for Use**                                           |
|-------------------------|--------------------------------------------------------------|
| **EMA (Exponential Moving Average)** | Fast, simple, and efficient at identifying short-term patterns and noise reduction. |
| **Holt-Winters**         | Suitable for trend forecasting, offering higher accuracy over longer periods. |
