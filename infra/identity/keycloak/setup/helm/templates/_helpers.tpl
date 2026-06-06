{{- define "telcox-keycloak.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "telcox-keycloak.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "telcox-keycloak.labels" -}}
app.kubernetes.io/name: {{ include "telcox-keycloak.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "telcox-keycloak.selectorLabels" -}}
app.kubernetes.io/name: {{ include "telcox-keycloak.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "telcox-keycloak.postgresqlName" -}}
{{- printf "%s-postgresql" (include "telcox-keycloak.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
