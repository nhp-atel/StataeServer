<%@ Page Language="C#" AutoEventWireup="true" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Web" %>
<%@ Import Namespace="System.Data" %>
<%@ Import Namespace="System.Data.SqlClient" %>
<%@ Import Namespace="System.Configuration" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>
<%@ Import Namespace="System.Collections.Generic" %>

<%
  Response.Clear();
  Response.ContentType = "application/json; charset=utf-8";
  Response.Cache.SetCacheability(HttpCacheability.NoCache);
  Response.Cache.SetNoStore();
  Response.TrySkipIisCustomErrors = true;

  // Connection string supports {0} -> "Middleware"
  string csTemplate = ConfigurationManager.ConnectionStrings["SQLConnString"].ConnectionString;
  string cs = string.Format(csTemplate, "Middleware");

  JavaScriptSerializer js = new JavaScriptSerializer(); js.MaxJsonLength = int.MaxValue;

  // sortid from query (may be missing — we’ll also accept it from POST body)
  int sortIdQuery;
  bool hasSortIdQuery = int.TryParse(Request["sortid"], out sortIdQuery);

  try
  {
    if (string.Equals(Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
    {
      if (!hasSortIdQuery) { Response.StatusCode = 400; Response.Write(@"{""error"":""missing or invalid sortid""}"); Response.End(); return; }
      int sortId = sortIdQuery;

      string mappingJson = null, message = null, updatedBy = null, updatedAtIso = null;

      using (SqlConnection cn = new SqlConnection(cs))
      using (SqlCommand cmd = new SqlCommand("dbo.usp_SwapState_GetLatest", cn))
      {
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.Parameters.Add("@sortid", SqlDbType.Int).Value = sortId;
        cn.Open();
        using (SqlDataReader r = cmd.ExecuteReader())
        {
          if (r.Read())
          {
            mappingJson = r["mapping_json"] as string;
            message     = r["message"] as string;
            object ub = r["updated_by"]; if (ub != DBNull.Value) updatedBy = ub as string;
            object ua = r["updated_at"]; if (ua != DBNull.Value) updatedAtIso = ((DateTime)ua).ToString("o");
          }
        }
      }

      if (string.IsNullOrEmpty(mappingJson)) mappingJson = "{}";

      Response.Write("{");
      Response.Write(@"""sortid"":" + sortId + ",");
      Response.Write(@"""mapping"":" + mappingJson + ","); // mappingJson is already JSON
      Response.Write(@"""message"":" + (message == null ? "null" : "\"" + HttpUtility.JavaScriptStringEncode(message) + "\"") + ",");
      Response.Write(@"""updatedBy"":" + (updatedBy == null ? "null" : "\"" + HttpUtility.JavaScriptStringEncode(updatedBy) + "\"") + ",");
      Response.Write(@"""updatedAt"":" + (updatedAtIso == null ? "null" : "\"" + updatedAtIso + "\""));
      Response.Write("}");
      Response.End(); return;
    }
    else if (string.Equals(Request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
    {
      // Read body as JSON
      string body; using (var sr = new StreamReader(Request.InputStream)) body = sr.ReadToEnd();
      Dictionary<string, object> obj = js.DeserializeObject(body) as Dictionary<string, object>;

      // Determine sortId: prefer body.sortid; fall back to query; else 400
      int sortId = -1, sidTmp;
      bool hasSortIdBody = (obj != null && obj.ContainsKey("sortid") && obj["sortid"] != null && int.TryParse(obj["sortid"].ToString(), out sidTmp));
      if (hasSortIdBody) sortId = sidTmp; else if (hasSortIdQuery) sortId = sortIdQuery;

      if (sortId < 0) { Response.StatusCode = 400; Response.Write(@"{""error"":""missing or invalid sortid""}"); Response.End(); return; }

      // mapping (object -> JSON)
      object mappingObj = null;
      if (obj != null && obj.ContainsKey("mapping")) mappingObj = obj["mapping"];
      string mappingJson = mappingObj == null ? "{}" : js.Serialize(mappingObj);

      // message (optional, max 4000)
      string message = null;
      if (obj != null && obj.ContainsKey("message") && obj["message"] != null) message = obj["message"].ToString();
      if (message != null && message.Length > 4000) message = message.Substring(0, 4000);

      // updatedBy (Windows / app-pool identity)
      string updatedBy = null;
      if (HttpContext.Current != null && HttpContext.Current.User != null && HttpContext.Current.User.Identity != null && !string.IsNullOrEmpty(HttpContext.Current.User.Identity.Name))
        updatedBy = HttpContext.Current.User.Identity.Name;
      if (string.IsNullOrEmpty(updatedBy)) { try { updatedBy = Environment.UserName; } catch { } }
      if (string.IsNullOrEmpty(updatedBy)) updatedBy = "unknown";

      using (SqlConnection cn = new SqlConnection(cs))
      using (SqlCommand cmd = new SqlCommand("dbo.usp_SwapState_Save", cn))
      {
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.Parameters.Add("@sortid", SqlDbType.Int).Value = sortId;
        cmd.Parameters.Add("@mapping_json", SqlDbType.NVarChar).Value = mappingJson;

        SqlParameter pMsg = cmd.Parameters.Add("@message", SqlDbType.NVarChar, 4000);
        pMsg.Value = (object)message ?? DBNull.Value;

        SqlParameter pUser = cmd.Parameters.Add("@updated_by", SqlDbType.NVarChar, 128);
        pUser.Value = (object)updatedBy ?? DBNull.Value;

        cn.Open();
        cmd.ExecuteNonQuery();
      }

      Response.Write(@"{""ok"":true}");
      Response.End(); return;
    }
    else
    {
      Response.StatusCode = 405;
      Response.Write(@"{""error"":""method not allowed""}");
      Response.End(); return;
    }
  }
  catch (Exception ex)
  {
    Response.StatusCode = 500;
    string msg = (Request.IsLocal || "1".Equals(Request["debug"])) ? ex.ToString() : "server_error";
    Response.Write("{\"error\":\"" + HttpUtility.JavaScriptStringEncode(msg) + "\"}");
    Response.End();
  }
%>
