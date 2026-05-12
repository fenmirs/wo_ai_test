## 1.获取token

- **方法**: `POST`
- **完整路径**: `http://192.168.17.128:25710/api-prj/openapi/security/token`

### Headers

| Key | Value | 备注 |
|-----|-------|------|
| `Content-Type` | application/json |  |

### Body (raw)

```json
{
  "appId": false,
  "appSecret": "67ZwYAzTpzVUHJBME2WSXmV6qvZT4ZWS"
}
```
## 2.常见错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
