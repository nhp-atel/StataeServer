<%@ Page Language="C#" AutoEventWireup="true"   %>
    <%@ Import Namespace="System.Data.SqlClient" %>


        <%
    /*--------------------------------------------
    ----------------------------------------------
    ---DATA SERVER TO GET CURRENT EXCEPTION INFO--
    ----------------------------------------------
    ------RETURNS JSON FILE WITH QUERY DATA-------
    ----------------------------------------------
    ----------------------------------------------*/

    string sortid = Request.QueryString["sortid"];

    string SqlConnectString = string.Format(ConfigurationManager.ConnectionStrings["SQLConnString"].ConnectionString, "Middleware");

    SqlConnection SQLconn = new SqlConnection(SqlConnectString);
    SQLconn.Open();

    string sqlCommand = string.Format(@"DECLARE @cols AS NVARCHAR(MAX),
                    @query  AS NVARCHAR(MAX);

                SET @cols = STUFF((SELECT distinct ',' + QUOTENAME(c.[metric]) 
                            FROM (select * from [Middleware].[dbo].[HourlyQuicklookValues] where sortid={0} and ([hourNumber] < 11 or [hourNumber]=99)) c
                            FOR XML PATH(''), TYPE
                            ).value('.', 'NVARCHAR(MAX)') 
                        ,1,1,'')
                    
                set @query = 'select * from (SELECT [hourNumber], TS,' + @cols + ' from 
                            (
                                select [hourNumber], convert(varchar, TS, 24) as TS
                                    , [value]
                                    , [metric]
                                from [Middleware].[dbo].[HourlyQuicklookValues] where sortid={0} and ([hourNumber] < 11 or [hourNumber]=99)
                        ) x
                            pivot 
                            (
                                max([value])
                                for [metric] in (' + @cols + ')
                            ) p ) a order by hourNumber FOR JSON PATH'

                execute(@query)
              ", sortid);

    SqlCommand SQLcmd = new SqlCommand(sqlCommand, SQLconn);
    SqlDataReader SQLreader = SQLcmd.ExecuteReader();

     string json = "";

    if (SQLreader.HasRows)
    {

        while (SQLreader.Read())
        {
            json += SQLreader[0].ToString();   
        }
        
    }

    SQLreader.Close();
    SQLconn.Close();

        Response.Clear();
        Response.ContentType = "application/json; charset=utf-8";
	Response.Write(json);
	Response.End();

%>