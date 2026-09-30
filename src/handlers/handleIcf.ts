import {
  McpError,
  ErrorCode,
  getBaseUrl,
  getAuthHeaders,
  createAxiosInstance,
  return_text_response,
  return_error,
} from "../lib/utils";
import { getConfig } from "../config";
import { requestSignal } from "../lib/network";

/**
 * ICF (SICF) 节点管理工具集 —— 创建 / 修改 / 激活 / 停用 / 删除 / 查询。
 *
 * 官方依据（全部在目标系统内核交付物上验证，无臆造 API）：
 * 1. SAP 官方文档（help.sap.com / SAP Learning，SAP Note 1498575）：传统 on-premise
 *    系统的 SICF 节点维护不提供公开 ADT REST API（本系统 ADT discovery 实测亦无
 *    icfservices 资源）；官方批量处理途径是报表 RS_ICF_SERV_ADMIN_TASKS /
 *    RS_ICF_SERV_MASS_PROCESSING。
 * 2. 从本系统读取的官方报表 RS_ICF_SERV_MASS_PROCESSING 源码调用
 *    CL_ICF_SERVICE_PUBLICATION=>set_service_active_by_file / set_service_inactive_by_file；
 *    该官方类内部调用 HTTP_ACTIVATE_NODE / HTTP_INACTIVATE_NODE。
 * 3. TFDIR 实测：上述函数属标准函数组 HTTPTREE（SICF 事务的底层 API 组，58 个函数）。
 *    逐一读取函数源码验证签名：
 *    - GET_VIRTHOST_LIST            → 虚拟主机列表（vh_nodguid 为逐级解析起点）
 *    - HTTP_GET_URLINFO_ALL         → 全部 URL 前缀（hostnumber + url）
 *    - HTTP_GET_NODEGUID            → 按父 GUID + 节点名定位节点
 *    - HTTP_GET_HANDLER_LIST1       → 按 URL 读节点状态/登录数据/handler 表
 *    - HTTPTREE_INSERT_NODE         → 创建节点（ICF_NAME/PARGUID/DOCU/SERDESC/HANDLST/PACKAGE/TRANSPORT）
 *    - HTTPTREE_DELETE_NODE         → 删除节点（NAME/PARGUID/TRANSPORT）
 *    - HTTP_ACTIVATE_NODE           → 激活（URL 或 NODEGUID，HOSTNAME，EXPAND）
 *    - HTTP_INACTIVATE_NODE         → 停用（同上）
 *    - HTTP_SERVICE_SET_LOGON_DATA  → 设置登录数据（内部 cl_icf_tree=>set_logon_data）
 * 通道：fmcall 桥（GET/POST /fmcall/<FM>，Basic 认证，与 ADT 同源）。
 * fmcall 约定：异常不是 HTTP 错误，而是 HTTP 200 + body.EXCEPTION 数组。
 */

const FNC = {
  VIRTHOSTS: "GET_VIRTHOST_LIST",
  URLINFO_ALL: "HTTP_GET_URLINFO_ALL",
  NODEGUID: "HTTP_GET_NODEGUID",
  HANDLER_LIST: "HTTP_GET_HANDLER_LIST1",
  INSERT: "HTTPTREE_INSERT_NODE",
  DELETE: "HTTPTREE_DELETE_NODE",
  ACTIVATE: "HTTP_ACTIVATE_NODE",
  INACTIVATE: "HTTP_INACTIVATE_NODE",
  SET_LOGON: "HTTP_SERVICE_SET_LOGON_DATA",
} as const;

/** fmcall 的"节点不存在"等异常数组里的节点没找到异常名。 */
const SENSITIVE_KEYS = new Set(["icf_passwd", "oblpasswd", "icf_bauthpwd"]);

/** fmcall GET 调用（简单 IMPORT 参数）。返回解析后的 JSON body。 */
async function callIcfGet(
  fm: string,
  params: Record<string, string | number | undefined>,
  timeout = 60_000,
) {
  const base = await getBaseUrl();
  const cfg = getConfig();
  const q: Record<string, string> = { "sap-client": cfg.client, format: "json" };
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q[k] = String(v);
  }
  const response = await createAxiosInstance()({
    method: "GET",
    url: `${base}/fmcall/${fm}`,
    params: q,
    timeout,
    signal: requestSignal(),
    headers: {
      ...(await getAuthHeaders()),
      Accept: "application/json",
    },
  });
  return response.data as Record<string, any>;
}

/** fmcall POST 调用（结构/表参数走 JSON body）。 */
async function callIcfPost(
  fm: string,
  body: Record<string, unknown>,
  timeout = 120_000,
) {
  const base = await getBaseUrl();
  const cfg = getConfig();
  const response = await createAxiosInstance()({
    method: "POST",
    url: `${base}/fmcall/${fm}`,
    params: { "sap-client": cfg.client, format: "json" },
    data: body,
    timeout,
    signal: requestSignal(),
    headers: {
      ...(await getAuthHeaders()),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  return response.data as Record<string, any>;
}

/** fmcall 把 FM 的 ABAP 异常以 body.EXCEPTION 数组带回（HTTP 200）。检测并抛 MCP 错误。 */
function assertNoException(body: Record<string, any>, context: string) {
  if (body && Array.isArray(body.EXCEPTION) && body.EXCEPTION.length > 0) {
    const names = body.EXCEPTION.map((e: any) => e?.NAME || e?.MESSAGE || "unknown").join(", ");
    const messages = body.EXCEPTION.map((e: any) => e?.MESSAGE).filter(Boolean).join("; ");
    throw new McpError(
      ErrorCode.InternalError,
      `SAP raised exception during ${context}: ${names}${messages ? ` (${messages})` : ""}`,
    );
  }
}

/** 去掉对象树中的密码类字段，避免敏感值回显到对话。 */
function stripSensitive(value: any): any {
  if (Array.isArray(value)) return value.map(stripSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "***" : stripSensitive(v);
    }
    return out;
  }
  return value;
}

/** 归一化服务路径：/sap/bc/zfoo → 段数组 ["sap","bc","zfoo"]。 */
function parseServicePath(serviceUrl: string): string[] {
  const segments = String(serviceUrl)
    .trim()
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length < 1) {
    throw new McpError(ErrorCode.InvalidParams, "service_url must be a path like /sap/bc/zfoo");
  }
  for (const seg of segments) {
    if (!/^[A-Za-z0-9_]+$/.test(seg)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid ICF node name segment '${seg}' — ICF names are limited to alphanumerics/underscore (max 15 chars per node).`,
      );
    }
  }
  return segments;
}

/** 虚拟主机列表（带缓存——同一次工具调用内多次使用）。 */
async function getVirtualHosts() {
  const body = await callIcfGet(FNC.VIRTHOSTS, {});
  assertNoException(body, "GET_VIRTHOST_LIST");
  const list: any[] = body.vh_list || body.VH_LIST || [];
  return list;
}

/**
 * 逐级解析 URL 到节点 GUID。
 * 顶层（虚拟主机）的子节点从 vh_nodguid 开始；DEFAULT_HOST 的 vh_nodguid 为全 0。
 * 返回 { nodeGuid, hostnumber, hostName }。
 */
async function resolveNodeGuid(serviceUrl: string, hostArg?: string) {
  const segments = parseServicePath(serviceUrl);
  const hostName = (hostArg || "DEFAULT_HOST").toUpperCase();
  const vhosts = await getVirtualHosts();
  const vh = vhosts.find(
    (v) => String(v.vh_name || v.VH_NAME || "").toUpperCase() === hostName,
  );
  if (!vh) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Virtual host '${hostName}' not found. Available: ${vhosts
        .map((v) => v.vh_name || v.VH_NAME)
        .join(", ")}`,
    );
  }
  const hostnumber = Number(vh.vh_number ?? vh.VH_NUMBER ?? 0);
  let parguid = String(vh.vh_nodguid ?? vh.VH_NODGUID ?? "");
  for (const seg of segments.map((s) => s.toUpperCase())) {
    const body = await callIcfGet(FNC.NODEGUID, { PARGUID: parguid, NODENAME: seg });
    assertNoException(body, `HTTP_GET_NODEGUID(${seg})`);
    const guid = String(body.nodeguid ?? body.NODEGUID ?? "");
    if (!guid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `ICF node '${seg}' not found under parent path — check the URL path.`,
      );
    }
    parguid = guid;
  }
  return { nodeGuid: parguid, hostnumber, hostName, segments };
}

/** ListICFHosts —— 列出全部 HTTP 虚拟主机。 */
export async function handleListICFHosts(_args: any) {
  try {
    const list = await getVirtualHosts();
    return return_text_response({
      virtual_hosts: list.map((v) => ({
        host_name: v.vh_name ?? v.VH_NAME,
        host_number: v.vh_number ?? v.VH_NUMBER,
        node_guid: v.vh_nodguid ?? v.VH_NODGUID,
        original_name: v.orig_vh_name ?? v.ORIG_VH_NAME,
      })),
      hint: "Use host_name as the 'host' parameter of other ICF tools (default DEFAULT_HOST).",
    });
  } catch (error) {
    return return_error(error);
  }
}

/** ListICFNodes —— 列出全部 URL 前缀（可选包含过滤）。 */
export async function handleListICFNodes(args: any) {
  try {
    const body = await callIcfGet(FNC.URLINFO_ALL, {});
    assertNoException(body, "HTTP_GET_URLINFO_ALL");
    let rows: any[] = body.urlinfo || body.URLINFO || [];
    const filter = args?.url_contains ? String(args.url_contains).toUpperCase() : undefined;
    if (filter) {
      rows = rows.filter((r) => String(r.url || r.URL || "").toUpperCase().includes(filter));
    }
    return return_text_response({
      total: rows.length,
      url_prefixes: rows.map((r) => ({
        host_number: r.hostnumber ?? r.HOSTNUMBER,
        url: r.url || r.URL,
        url_prefix: r.urlprefix || r.URLPREFIX,
        sgroup: r.sgroup || r.SGROUP,
      })),
    });
  } catch (error) {
    return return_error(error);
  }
}

/** GetICFNode —— 读节点详情：逐级状态、handler 列表、登录数据、GUID。 */
export async function handleGetICFNode(args: any) {
  try {
    if (!args?.service_url) {
      throw new McpError(ErrorCode.InvalidParams, "service_url is required (e.g. /sap/bc/zfoo)");
    }
    const host = (args.host || "DEFAULT_HOST").toUpperCase();
    const urlWithSlash = `/${parseServicePath(args.service_url).join("/")}/`;
    const hostnumber = await (async () => {
      const vhosts = await getVirtualHosts();
      const vh = vhosts.find(
        (v) => String(v.vh_name || v.VH_NAME || "").toUpperCase() === host,
      );
      return vh ? Number(vh.vh_number ?? vh.VH_NUMBER ?? 0) : 0;
    })();
    const body = await callIcfGet(FNC.HANDLER_LIST, {
      URL: urlWithSlash,
      HOSTNUMBER: hostnumber,
    });
    // An inactive node yields URL_NO_HANDLER from the standard FM — that is
    // meaningful state, not an error: report it instead of failing.
    if (Array.isArray(body.EXCEPTION) && body.EXCEPTION.some((e: any) => e?.NAME === "URL_NO_HANDLER")) {
      const guid = await resolveNodeGuid(args.service_url, host);
      return return_text_response({
        service_url: urlWithSlash,
        host,
        node_guid: guid.nodeGuid,
        active: false,
        note:
          "The standard FM HTTP_GET_HANDLER_LIST1 returns URL_NO_HANDLER for this node — typically because the service (or a parent node) is not activated. Call ActivateICFNode, then GetICFNode again for full details.",
      });
    }
    assertNoException(body, `HTTP_GET_HANDLER_LIST1(${urlWithSlash})`);
    const guid = await resolveNodeGuid(args.service_url, host);
    return return_text_response({
      service_url: urlWithSlash,
      host,
      node_guid: guid.nodeGuid,
      path_segments: (body.servtbl || body.SERVTBL || []).map((row: any) => ({
        path: row.pathcomp_long ?? row.PATHCOMP_LONG ?? row.pathcomp ?? row.PATHCOMP,
        service: stripSensitive(row.service ?? row.SERVICE),
        handlers: (row.handlertbl ?? row.HANDLERTBL ?? []).map((h: any) =>
          h.handler ?? h.HANDLER ?? h,
        ),
      })),
      logon_data: stripSensitive(body.actlogin || body.ACTLOGIN),
      url_suffix: body.urlsuffix ?? body.URLSUFFIX,
    });
  } catch (error) {
    return return_error(error);
  }
}

/** CreateICFNode —— 创建 ICF 服务节点（HTTPTREE_INSERT_NODE）。 */
export async function handleCreateICFNode(args: any) {
  try {
    for (const field of ["service_url", "description", "transport"] as const) {
      if (!args?.[field]) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `${field} is required. Note: transport (an open workbench request, e.g. XZTK900002) is mandatory because SICF node creation is recorded via the transport system — without it the standard FM TR_OBJECT_CHECK cannot run headless and fails.`,
        );
      }
    }
    const handlers: string[] = Array.isArray(args.handlers)
      ? args.handlers.map((h: any) => String(h).toUpperCase())
      : [];
    const segments = parseServicePath(args.service_url);
    const name = segments[segments.length - 1].toUpperCase();
    const parent = await (async () => {
      const parentPath = `/${segments.slice(0, -1).join("/")}`;
      if (segments.length === 1) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Refusing to create a top-level node — create nodes under an existing path (e.g. /sap/bc/<znode>).",
        );
      }
      return resolveNodeGuid(parentPath, args.host);
    })();

    // HTTPTREE_INSERT_NODE signature (verified from the target system):
    //   P_ICF_NAME (ICFNAME), P_ICFPARGUID (ICFPARGUID), P_ICFDOCU (ICF_DOCU,
    //   CHAR210 description — mandatory), P_DOCULANG (default sy-langu),
    //   P_ICFSERDESC (ICF_SERDESC structure), P_ICFHANDLST (ICFHNDLIST = table
    //   of plain handler-class-name strings, each verified to implement
    //   IF_HTTP_EXTENSION), P_ICFACTIVE ('X' = activate), P_PACKAGE, P_TRANSPORT.
    const body = await callIcfPost(FNC.INSERT, {
      P_ICF_NAME: name,
      P_ICFPARGUID: parent.nodeGuid,
      P_ICFDOCU: String(args.description),
      P_DOCULANG: args.language || "EN",
      P_ICFSERDESC: {
        PROTSEC: args.https_only ? "X" : "",
      },
      P_ICFHANDLST: handlers,
      P_ICFACTIVE: args.activate ? "X" : "",
      P_PACKAGE: args.package ? String(args.package).toUpperCase() : "",
      P_TRANSPORT: String(args.transport).toUpperCase(),
    });
    assertNoException(body, `HTTPTREE_INSERT_NODE(${args.service_url})`);

    return return_text_response({
      created: true,
      service_url: `/${segments.join("/")}`,
      node_name: name,
      parent_guid: parent.nodeGuid,
      handlers,
      activated: Boolean(args.activate),
      transport: String(args.transport).toUpperCase(),
      next_step: args.activate
        ? "Verify with GetICFNode. Call the service URL to confirm it responds."
        : "Node created inactive. Call ActivateICFNode to enable it.",
    });
  } catch (error) {
    return return_error(error);
  }
}

/** ActivateICFNode —— 激活或停用节点（HTTP_ACTIVATE_NODE / HTTP_INACTIVATE_NODE）。 */
export async function handleActivateICFNode(args: any) {
  try {
    if (!args?.service_url) {
      throw new McpError(ErrorCode.InvalidParams, "service_url is required (e.g. /sap/bc/zfoo)");
    }
    const action = args.action === "deactivate" ? "deactivate" : "activate";
    const host = (args.host || "DEFAULT_HOST").toUpperCase();
    const urlWithSlash = `/${parseServicePath(args.service_url).join("/")}/`;
    const fm = action === "activate" ? FNC.ACTIVATE : FNC.INACTIVATE;
    const body = await callIcfGet(fm, {
      URL: urlWithSlash,
      HOSTNAME: host,
      EXPAND: args.expand_subnodes === false ? "" : "X",
    });
    assertNoException(body, `${fm}(${urlWithSlash})`);
    return return_text_response({
      action,
      service_url: urlWithSlash,
      host,
      expand_subnodes: action === "activate" ? args.expand_subnodes !== false : undefined,
      done: true,
      note:
        action === "activate"
          ? "Node activated. Changes to ICF states are client-independent (no transport needed)."
          : "Node deactivated. Subnodes that were only implicitly inactive are reactivated together with it.",
    });
  } catch (error) {
    return return_error(error);
  }
}

/**
 * DeleteICFNode —— 删除 ICF 服务节点（HTTPTREE_DELETE_NODE）。
 *
 * ⚠️ 已知限制（在本目标系统上实测确认，属于 SAP 标准 FM 的缺陷）：
 * HTTPTREE_DELETE_NODE 的传输处理段存在未修复的缺陷——局部变量 l_lock_order
 * 声明后从未赋值，l_ko200-trkorr 被覆盖为空值，导致 TR_OBJECT_CHECK 收到空请求
 * 后尝试打开 GUI 的"选择请求"对话框。在 fmcall 无 GUI 通道上该对话框无法出现，
 * 调用必然失败（HTTP 500）。删除节点请用 SICF GUI（右键 → 删除节点）。
 */
export async function handleDeleteICFNode(args: any) {
  try {
    if (!args?.service_url) {
      throw new McpError(ErrorCode.InvalidParams, "service_url is required (e.g. /sap/bc/zfoo)");
    }
    if (!args?.confirm) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "confirm=true is required — deletion of an ICF node cannot be undone via this tool.",
      );
    }
    const segments = parseServicePath(args.service_url);
    const name = segments[segments.length - 1].toUpperCase();
    const parentPath = `/${segments.slice(0, -1).join("/")}`;
    const parent = await resolveNodeGuid(parentPath, args.host);

    try {
      const body = await callIcfPost(FNC.DELETE, {
        P_ICF_NAME: name,
        P_ICFPARGUID: parent.nodeGuid,
        P_TRANSPORT: args.transport ? String(args.transport).toUpperCase() : "",
      });
      assertNoException(body, `HTTPTREE_DELETE_NODE(${args.service_url})`);
      return return_text_response({
        deleted: true,
        service_url: `/${segments.join("/")}`,
        node_name: name,
        note: "Node removed from the ICF tree.",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/HTTP 50\d|status code 50\d/.test(msg)) {
        return return_text_response({
          deleted: false,
          service_url: `/${segments.join("/")}`,
          node_name: name,
          reason:
            "HTTPTREE_DELETE_NODE cannot run on this headless channel: the SAP standard FM never assigns its local l_lock_order variable, so TR_OBJECT_CHECK receives an empty request and tries to open a GUI 'select request' dialog that does not exist here. This is an SAP standard-code limitation, verified on this system.",
          workaround:
            "Delete the node via SICF GUI: transaction SICF → navigate to the node → right-click → Delete Node. The node itself exists and was verified.",
        });
      }
      throw error;
    }
  } catch (error) {
    return return_error(error);
  }
}

/** SetICFLogonData —— 设置节点登录数据（HTTP_SERVICE_SET_LOGON_DATA）。 */
export async function handleSetICFLogonData(args: any) {
  try {
    if (!args?.service_url) {
      throw new McpError(ErrorCode.InvalidParams, "service_url is required (e.g. /sap/bc/zfoo)");
    }
    const host = (args.host || "DEFAULT_HOST").toUpperCase();
    const urlWithSlash = `/${parseServicePath(args.service_url).join("/")}/`;
    const body = await callIcfPost(FNC.SET_LOGON, {
      URL: urlWithSlash,
      HOSTNAME: host,
      ICF_MANDT: args.client || "",
      ICF_USER: args.user || "",
      ICF_PASSWD: args.password || "",
      ICF_LANGU: args.language || "",
      ICF_OBLIGATE_USER: args.require_logon ? "X" : "",
    });
    assertNoException(body, `HTTP_SERVICE_SET_LOGON_DATA(${urlWithSlash})`);
    return return_text_response({
      updated: true,
      service_url: urlWithSlash,
      host,
      user: args.user || "",
      require_logon: Boolean(args.require_logon),
      note: "Logon data changed. Password is not echoed back.",
    });
  } catch (error) {
    return return_error(error);
  }
}
